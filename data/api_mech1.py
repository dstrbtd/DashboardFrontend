"""
FastAPI Backend for Mechanism 1 Dashboard
Serves strategy data from InfluxDB as a clean JSON API
"""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
from influxdb_client import InfluxDBClient
from dotenv import load_dotenv
import requests
from typing import Optional
import uvicorn

# ------------------------------
# Load ENV Variables
# ------------------------------
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ENV_PATH = os.path.join(PROJECT_ROOT, ".env")

if os.path.exists(ENV_PATH):
    load_dotenv(ENV_PATH)

# ------------------------------
# InfluxDB Config
# ------------------------------
INFLUXDB_URL = os.getenv("INFLUXDB_URL")
INFLUXDB_ORG = os.getenv("INFLUXDB_ORG")
INFLUXDB_TOKEN = os.getenv("INFLUXDB_TOKEN_MECHANISM_1")
INFLUXDB_BUCKET = os.getenv("INFLUXDB_BUCKET_MECHANISM_1")
INFLUXDB_MEASUREMENT = "hotkey_scores"
INFLUXDB_BENCHMARK_MEASUREMENT = "benchmark_scores"

client = InfluxDBClient(url=INFLUXDB_URL, token=INFLUXDB_TOKEN, org=INFLUXDB_ORG)
query_api = client.query_api()

# ------------------------------
# FastAPI App
# ------------------------------
app = FastAPI(title="Mechanism 1 API", version="1.0.0")

# CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def shorten_hotkey(value, prefix=8, suffix=4):
    """Shorten hotkey for display"""
    if value is None:
        return ""
    s = str(value)
    if len(s) <= prefix + suffix + 3:
        return s
    return f"{s[:prefix]}...{s[-suffix:]}"


# Simple cache for gist filenames to avoid repeated API calls
_gist_filename_cache = {}

# GitHub token for higher rate limits (optional)
GITHUB_TOKEN = os.environ.get('GITHUB_TOKEN', '')

def extract_gist_filename(gist_url):
    """Extract a readable filename from gist URL by fetching from GitHub API"""
    if not gist_url or not isinstance(gist_url, str):
        return None
    
    # Handle benchmark URLs (not real gists)
    if gist_url.startswith('benchmark_'):
        return gist_url.replace('_', ' ').title()
    
    # Check cache first
    if gist_url in _gist_filename_cache:
        return _gist_filename_cache[gist_url]
    
    try:
        parts = gist_url.rstrip('/').split('/')
        if len(parts) >= 1:
            gist_id = parts[-1]
            # Skip if gist_id looks invalid
            if not gist_id or len(gist_id) < 10:
                return None
            
            # Try to fetch the actual filename from GitHub
            try:
                api_url = f"https://api.github.com/gists/{gist_id}"
                headers = {}
                if GITHUB_TOKEN:
                    headers['Authorization'] = f'token {GITHUB_TOKEN}'
                response = requests.get(api_url, headers=headers, timeout=5)
                if response.status_code == 200:
                    gist_data = response.json()
                    files = gist_data.get('files', {})
                    if files:
                        # Return the first file's name
                        filename = list(files.keys())[0]
                        _gist_filename_cache[gist_url] = filename
                        return filename
                elif response.status_code == 403:
                    print(f"GitHub API rate limited. Consider setting GITHUB_TOKEN env var.")
            except Exception as e:
                print(f"GitHub API error for {gist_id}: {e}")
            
            # Fallback: return None to let frontend use hotkey
            return None
    except:
        pass
    return None


def fetch_gist_code(gist_url, max_lines=100):
    """Fetch the actual code content from a GitHub Gist"""
    if not gist_url or not isinstance(gist_url, str):
        return "# No code available"
    
    try:
        parts = gist_url.rstrip('/').split('/')
        gist_id = parts[-1]
        api_url = f"https://api.github.com/gists/{gist_id}"
        
        response = requests.get(api_url, timeout=5)
        if response.status_code == 200:
            gist_data = response.json()
            files = gist_data.get('files', {})
            if files:
                first_file = list(files.values())[0]
                content = first_file.get('content', '# No content')
                filename = first_file.get('filename', 'strategy.py')
                lines = content.split('\n')
                truncated = len(lines) > max_lines
                if truncated:
                    content = '\n'.join(lines[:max_lines]) + f"\n\n# ... ({len(lines) - max_lines} more lines)"
                return {"content": content, "filename": filename, "truncated": truncated, "total_lines": len(lines)}
    except Exception as e:
        return {"content": f"# Error fetching code: {str(e)}", "filename": "error.py", "truncated": False, "total_lines": 0}
    
    return {"content": "# Unable to fetch code", "filename": "unknown.py", "truncated": False, "total_lines": 0}


def load_mechanism1_metrics(current_block=None):
    """Query InfluxDB for mechanism 1 metrics"""
    try:
        query = f"""
        from(bucket: "{INFLUXDB_BUCKET}")
          |> range(start: -30d)
          |> filter(fn: (r) => r._measurement == "{INFLUXDB_MEASUREMENT}")
          |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
        """
        df = query_api.query_data_frame(query)

        if isinstance(df, list):
            df = pd.concat(df)
        if df.empty:
            return pd.DataFrame(), pd.DataFrame(), {}, None, []
    except Exception as e:
        print(f"Error querying InfluxDB: {e}")
        return pd.DataFrame(), pd.DataFrame(), {}, None, []

    df["current_block"] = df["current_block"].fillna(0).astype(int)
    all_blocks = sorted(df["current_block"].unique(), reverse=True)
    latest_current_block = df["current_block"].max()
    
    if current_block is None:
        current_block = latest_current_block

    filtered_df = df[df["current_block"] == current_block].copy()
    filtered_df = filtered_df.drop(
        columns=[c for c in filtered_df.columns if c in ["result", "table", "_start", "_stop", "_measurement"]], 
        errors="ignore"
    )

    if filtered_df.empty:
        return df, pd.DataFrame(), {}, current_block, all_blocks

    filtered_df["_time"] = pd.to_datetime(filtered_df["_time"]).dt.tz_convert("UTC")

    # Extract metadata from actual data
    metadata_fields = ["dataset", "max_steps", "model_size", "number_of_nodes"]
    metadata = {}
    for field in metadata_fields:
        if field in filtered_df.columns:
            val = filtered_df[field].iloc[0]
            metadata[field] = str(val) if pd.notna(val) else None
    
    # Fill in defaults only for missing fields
    defaults = {'dataset': 'owt', 'max_steps': '100', 'model_size': 'small', 'number_of_nodes': '4'}
    for key, default_val in defaults.items():
        if not metadata.get(key):
            metadata[key] = default_val

    filtered_df = filtered_df.drop(columns=metadata_fields + ["current_block"], errors="ignore")
    filtered_df["_time"] = filtered_df["_time"].dt.strftime("%Y-%m-%d %H:%M")
    
    if "last_update" in filtered_df.columns:
        filtered_df["last_update"] = pd.to_datetime(filtered_df["last_update"]).dt.strftime("%Y-%m-%d %H:%M")

    # Sort by score descending and add rank
    if "score" in filtered_df.columns:
        filtered_df = filtered_df.sort_values(by="score", ascending=False)
        filtered_df["rank"] = range(1, len(filtered_df) + 1)

    return df, filtered_df, metadata, current_block, all_blocks


def load_benchmark_entries(metadata):
    """Load benchmark entries matching the given metadata as individual strategies.
    If no benchmarks match the exact metadata, fall back to the latest available benchmarks."""
    try:
        query = f"""
        from(bucket: "{INFLUXDB_BUCKET}")
          |> range(start: -30d)
          |> filter(fn: (r) => r._measurement == "{INFLUXDB_BENCHMARK_MEASUREMENT}")
          |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
        """
        df = query_api.query_data_frame(query)

        if isinstance(df, list):
            df = pd.concat(df)
        if df.empty:
            return []

        df = df.drop(
            columns=[c for c in df.columns if c in ["result", "table", "_start", "_stop", "_measurement"]], 
            errors="ignore"
        )

        # Try to filter by exact metadata match
        filtered_df = df.copy()
        for field in ["dataset", "max_steps", "model_size", "number_of_nodes"]:
            if field in filtered_df.columns and metadata.get(field):
                filtered_df = filtered_df[filtered_df[field].astype(str) == str(metadata[field])]

        # If no exact match, fall back to latest available benchmarks
        if filtered_df.empty:
            print(f"No benchmarks match metadata {metadata}, using latest available benchmarks")
            # Sort by time and get the latest benchmarks
            if "_time" in df.columns:
                df["_time"] = pd.to_datetime(df["_time"])
                df = df.sort_values("_time", ascending=False)
            # Use all available benchmarks (deduplicated by hotkey)
            filtered_df = df.drop_duplicates(subset=["hotkey"], keep="first")
        else:
            # Get the latest entry for each unique benchmark (by hotkey)
            if "_time" in filtered_df.columns:
                filtered_df["_time"] = pd.to_datetime(filtered_df["_time"])
                filtered_df = filtered_df.sort_values("_time", ascending=False)
                filtered_df = filtered_df.drop_duplicates(subset=["hotkey"], keep="first")

        benchmarks = []
        for _, row in filtered_df.iterrows():
            gist_url = safe_str(row.get('gist_url', ''))
            hotkey = safe_str(row.get('hotkey', ''))
            
            # Create a readable name from the benchmark hotkey
            if hotkey.startswith('benchmark_'):
                name = hotkey.replace('benchmark_', '').replace('_', ' ').title()
            else:
                name = gist_url if gist_url.startswith('benchmark_') else 'Benchmark'
            
            # Format last_update nicely
            last_update_raw = safe_str(row.get('last_update', ''))
            try:
                if last_update_raw:
                    # Parse ISO format and convert to nice format
                    from datetime import datetime
                    dt = datetime.fromisoformat(last_update_raw.replace('Z', '+00:00'))
                    last_update_formatted = dt.strftime('%Y-%m-%d %H:%M')
                else:
                    last_update_formatted = ''
            except:
                last_update_formatted = last_update_raw[:16] if len(last_update_raw) > 16 else last_update_raw
            
            benchmarks.append({
                "uid": None,
                "hotkey": hotkey,
                "hotkey_short": name,
                "score": safe_float(row.get('score', 0)) or 0.0,
                "loss": safe_float(row.get('loss')),
                "communication": safe_int(row.get('communication')),
                "throughput": safe_int(row.get('throughput')),
                "gist_url": gist_url,
                "filename": name,
                "last_update": last_update_formatted,
                "time": "",
                "is_benchmark": True
            })

        return benchmarks
    except Exception as e:
        print(f"Error loading benchmark entries: {e}")
        return []


def safe_int(val):
    """Convert numpy int to Python int safely"""
    if val is None or (hasattr(pd, 'isna') and pd.isna(val)):
        return None
    try:
        return int(val)
    except (TypeError, ValueError):
        return None

def safe_float(val):
    """Convert numpy float to Python float safely"""
    if val is None or (hasattr(pd, 'isna') and pd.isna(val)):
        return None
    try:
        return float(val)
    except (TypeError, ValueError):
        return None

def safe_str(val):
    """Convert value to string safely"""
    if val is None or (hasattr(pd, 'isna') and pd.isna(val)):
        return ''
    return str(val)


@app.get("/api/mech1/strategies")
async def get_strategies(block: Optional[int] = None):
    """Get all strategies for a given block (or latest if not specified)"""
    _, filtered_df, metadata, current_block, all_blocks = load_mechanism1_metrics(block)
    
    # Load miner strategies
    miner_strategies = []
    if not filtered_df.empty:
        for _, row in filtered_df.iterrows():
            gist_url = safe_str(row.get('gist_url', ''))
            miner_strategies.append({
                "uid": safe_int(row.get('uid')),
                "hotkey": safe_str(row.get('hotkey', '')),
                "hotkey_short": shorten_hotkey(safe_str(row.get('hotkey', ''))),
                "score": safe_float(row.get('score', 0)) or 0.0,
                "loss": safe_float(row.get('loss')),
                "communication": safe_int(row.get('communication')),
                "throughput": safe_int(row.get('throughput')),
                "gist_url": gist_url,
                "filename": extract_gist_filename(gist_url),
                "last_update": safe_str(row.get('last_update', '')),
                "time": safe_str(row.get('_time', '')),
                "is_benchmark": False
            })
    
    # Load benchmark strategies
    benchmark_strategies = load_benchmark_entries(metadata)
    
    # Combine all strategies
    all_strategies = miner_strategies + benchmark_strategies
    
    # Sort by score descending and assign ranks
    all_strategies.sort(key=lambda x: x.get('score', 0) or 0, reverse=True)
    for i, strategy in enumerate(all_strategies):
        strategy['rank'] = i + 1
    
    return {
        "strategies": all_strategies,
        "metadata": metadata,
        "current_block": safe_int(current_block),
        "available_blocks": [int(b) for b in all_blocks] if all_blocks else [],
        "total_strategies": len(all_strategies),
        "miner_count": len(miner_strategies),
        "benchmark_count": len(benchmark_strategies)
    }


@app.get("/api/mech1/code/{gist_id}")
async def get_strategy_code(gist_id: str):
    """Fetch code content for a specific gist"""
    gist_url = f"https://gist.github.com/{gist_id}"
    return fetch_gist_code(gist_url)


@app.get("/api/mech1/blocks")
async def get_available_blocks():
    """Get list of available blocks"""
    _, _, _, current_block, all_blocks = load_mechanism1_metrics(None)
    return {
        "current_block": current_block,
        "available_blocks": [int(b) for b in all_blocks]
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "mech1-api"}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=22557)



