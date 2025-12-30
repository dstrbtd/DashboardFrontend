import os
import dash
import dash_ag_grid as dag
import pandas as pd
from dash import html, dcc, Input, Output
from influxdb_client import InfluxDBClient
from dotenv import load_dotenv

# ------------------------------
# Load ENV Variables
# ------------------------------
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ENV_PATH = os.path.join(PROJECT_ROOT, ".env")

if os.path.exists(ENV_PATH):
    load_dotenv(ENV_PATH)
else:
    raise FileNotFoundError(f"Warning: .env file not found at expected location: {ENV_PATH}")

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

def shorten_middle(value, prefix=10, suffix=2):
    if value is None:
        return ""
    s = str(value)
    if len(s) <= prefix + suffix + 3:
        return s
    return f"{s[:prefix]}...{s[-suffix:]}"

# ------------------------------
# Query Latest Metrics
# ------------------------------
def load_mechanism1_metrics(current_block = None):
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
            return pd.DataFrame(), pd.DataFrame(), {}, None
    except Exception as e:
        print(f"Error querying InfluxDB bucket '{INFLUXDB_BUCKET}': {e}")
        return pd.DataFrame(), pd.DataFrame(), {}, None

    df["current_block"] = df["current_block"].fillna(0).astype(int)
    latest_current_block = df["current_block"].max()
    if current_block is None:
        current_block = latest_current_block

    filtered_df = df[df["current_block"] == current_block]

    # Drop metadata columns added by InfluxDB
    filtered_df = filtered_df.drop(columns=[c for c in filtered_df.columns if c in ["result", "table", "_start", "_stop", "_measurement"]], errors="ignore")

    # Handle empty filtered DataFrame
    if filtered_df.empty:
        return df, pd.DataFrame(), {}, current_block

    # Make sure _time is datetime and sorted
    filtered_df["_time"] = pd.to_datetime(filtered_df["_time"]).dt.tz_convert("UTC")

    # -----------------------------
    # Extract shared metadata
    # -----------------------------
    metadata_fields = ["dataset", "max_steps", "model_size", "number_of_nodes"]

    # Assume all rows share the same values → take first row
    metadata = {}
    for field in metadata_fields:
        if field in filtered_df.columns:
            metadata[field] = filtered_df[field].iloc[0]
    metadata = {'dataset': 'owt', 'max_steps': '100', 'model_size': 'medium', 'number_of_nodes': '4'}

    # Debug: print metadata extraction
    if metadata:
        print(f"Extracted metadata: {metadata}")
    else:
        print(f"WARNING: No metadata extracted. Available columns: {list(filtered_df.columns)}")

    # Remove metadata from table view
    filtered_df = filtered_df.drop(columns=metadata_fields+["current_block"], errors="ignore")

    # Final display format for time (no seconds/ms)
    filtered_df["_time"] = filtered_df["_time"].dt.strftime("%Y-%m-%d %H:%M")
    filtered_df["last_update"] = pd.to_datetime(filtered_df["last_update"]).dt.strftime("%Y-%m-%d %H:%M")

    # Shorten long strings
    if "hotkey" in filtered_df.columns:
        filtered_df["hotkey"] = filtered_df["hotkey"].apply(shorten_middle)

    # Round score to 4 decimal places if present
    if "score" in filtered_df.columns:
        filtered_df["score"] = filtered_df["score"].round(4)

    # Round loss to 2 decimal places if present
    if "loss" in filtered_df.columns:
        filtered_df["loss"] = filtered_df["loss"].round(2)
    
    # Format communication and throughput with commas (thousands separators) before renaming
    if "communication" in filtered_df.columns:
        filtered_df["communication"] = filtered_df["communication"].apply(
            lambda x: f"{int(x):,}" if pd.notna(x) and not pd.isnull(x) else x
        )
    
    if "throughput" in filtered_df.columns:
        filtered_df["throughput"] = filtered_df["throughput"].apply(
            lambda x: f"{int(x):,}" if pd.notna(x) and not pd.isnull(x) else x
        )

    filtered_df = filtered_df.sort_values(by="score", ascending = False)

    # Rename columns
    rename_map = {
        "_time": "Time",
        "uid": "UID",
        "hotkey": "Hotkey",
        "gist_url": "Gist URL",
        "last_update": "Last Update",
    }
    filtered_df = filtered_df.rename(columns=rename_map)

    # Make Gist Url clickable (Markdown)
    if "Gist URL" in filtered_df.columns:
        filtered_df["Gist URL Tooltip"] = filtered_df["Gist URL"]

        filtered_df["Gist URL"] = filtered_df["Gist URL"].apply(
            lambda u: f"[{u}]({u})" if isinstance(u, str) and u else ""
        )

    return df, filtered_df, metadata, current_block


def load_benchmark_metrics(metadata):
    """
    Load benchmark metrics matching the given metadata (dataset, max_steps, model_size, number_of_nodes).
    Returns the latest benchmark data regardless of block.
    """
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
            return {}

        # Drop metadata columns added by InfluxDB
        df = df.drop(columns=[c for c in df.columns if c in ["result", "table", "_start", "_stop", "_measurement"]], errors="ignore")

        # Filter by metadata to match the configuration
        # Convert to string for comparison to handle type mismatches
        if "dataset" in df.columns and metadata.get("dataset"):
            df = df[df["dataset"].astype(str) == str(metadata["dataset"])]
        if "max_steps" in df.columns and metadata.get("max_steps"):
            df = df[df["max_steps"].astype(str) == str(metadata["max_steps"])]
        if "model_size" in df.columns and metadata.get("model_size"):
            df = df[df["model_size"].astype(str) == str(metadata["model_size"])]
        if "number_of_nodes" in df.columns and metadata.get("number_of_nodes"):
            df = df[df["number_of_nodes"].astype(str) == str(metadata["number_of_nodes"])]

        if df.empty:
            return {}

        # Convert _time for score extraction if needed
        if "_time" in df.columns:
            df["_time"] = pd.to_datetime(df["_time"]).dt.tz_convert("UTC")

        # Aggregate benchmark metrics across all matching records:
        # - Minimum loss (2 decimal places)
        # - Minimum communication (with comma formatting)
        # - Maximum throughput (with comma formatting)
        benchmark_metrics = {}
        
        if "loss" in df.columns:
            loss_values = df["loss"].dropna()
            if not loss_values.empty:
                benchmark_metrics["loss"] = round(float(loss_values.min()), 2)
        
        if "communication" in df.columns:
            comm_values = df["communication"].dropna()
            if not comm_values.empty:
                benchmark_metrics["communication"] = int(comm_values.min())
        
        if "throughput" in df.columns:
            throughput_values = df["throughput"].dropna()
            if not throughput_values.empty:
                benchmark_metrics["throughput"] = int(throughput_values.max())

        return benchmark_metrics
    except Exception as e:
        print(f"Error loading benchmark metrics: {e}")
        return {}


# Cache for performance
cached_df, filtered_cached_df, cached_meta, cached_current_block = load_mechanism1_metrics()

# Handle empty DataFrame case
if cached_df.empty or "current_block" not in cached_df.columns:
    block_options = []
    default_block = None
else:
    block_options = [{"label": str(b), "value": b} for b in sorted(cached_df["current_block"].unique(), reverse=True)]
    default_block = cached_current_block


# ------------------------------
# Dash App
# ------------------------------
app = dash.Dash(__name__)
app.title = "Mechanism 1 Metrics Dashboard"

app.layout = html.Div([
    html.Div(
        id="meta-boxes",
        className="info-boxes-row",
        style={
            "marginBottom": "2.5rem",
            "width": "100%"
        }
    ),

    html.Div([
        html.Div([
            html.Label("Select Block:",
                 style={
                        "color": "rgba(255, 255, 255, 0.8)",
                        "fontSize": "14px",
                        "fontWeight": "500",
                        "marginRight": "12px",
                        "whiteSpace": "nowrap"
                }),
        dcc.Dropdown(
            id="current_block_dropdown",
            options=[{"label": str(b), "value": b} for b in sorted(cached_df["current_block"].unique(), reverse=True)],
            multi=False,
            value=cached_current_block,
            className="dark-dropdown",
                style={"width": "250px", "flexShrink": 0, "maxWidth": "100%"}
        )
        ], style={
            "display": "flex", 
            "justifyContent": "center",
            "alignItems": "center", 
            "padding": "12px 16px",
            "backgroundColor": "rgba(20, 20, 20, 0.5)",
            "borderRadius": "8px",
            "border": "1px solid rgba(255, 255, 255, 0.08)",
            "width": "fit-content",
            "minWidth": "fit-content",
            "boxSizing": "border-box"
        })
    ], className="dropdown-wrapper", style={
        "marginBottom": "20px"
    }),

    dag.AgGrid(
        id="subnet1-grid",
        columnDefs=[{"field": c, "sortable": True, "filter": True, "resizable": True}
                    for c in filtered_cached_df.columns],
        rowData=filtered_cached_df.to_dict("records"),
        className="ag-theme-alpine-dark",
        style={"height": "90vh", "width": "100%"},
        defaultColDef={
            "sortable": True,
            "filter": True,
            "resizable": True,
            "flex": 1,
            "minWidth": 120,
            "cellStyle": {
                "display": "flex",
                "justifyContent": "center",
                "alignItems": "center",
                "textAlign": "center",
            },
        }
    ),

    html.Div([
        html.Div(id="last-updated", className="last-updated")
    ], style={
        "display": "flex",
        "justifyContent": "center",
        "width": "100%"
    }),

    dcc.Interval(id="refresh", interval=10 * 1000, n_intervals=0)
], className="app-container", style={"backgroundColor": "black", "padding": "20px"})


# ------------------------------
# Refresh Callback
# ------------------------------
@app.callback(
    Output("meta-boxes", "children"),
    Output("subnet1-grid", "rowData"),
    Output("subnet1-grid", "columnDefs"),
    Output("last-updated", "children"),
    Output("current_block_dropdown", "value"),
    Output("current_block_dropdown", "options"),
    Input("refresh", "n_intervals"),
    Input("current_block_dropdown", "value"),
)
def reload_data(_, selected_block):
    global cached_df, filtered_cached_df, cached_meta, cached_current_block
    try:
        # Load all data first to get block options
        df_all, _, _, latest_block = load_mechanism1_metrics(None)
        if not df_all.empty and "current_block" in df_all.columns:
            cached_df = df_all
            cached_current_block = latest_block
        
        # Get block options safely
        if cached_df.empty or "current_block" not in cached_df.columns:
            all_blocks = []
        else:
            all_blocks = [{"label": str(b), "value": b} for b in sorted(cached_df["current_block"].unique(), reverse=True)]

        # If user cleared the selection or it's missing → auto-select the latest
        if selected_block is None:
            selected_block = cached_current_block
        elif all_blocks and selected_block not in [b["value"] for b in all_blocks]:
            selected_block = cached_current_block
        
        # Load the data for the selected block
        _, filtered_cached_df, cached_meta, _ = load_mechanism1_metrics(selected_block)
        print("cached_meta: ", cached_meta)
        # Load benchmark metrics matching the metadata
        benchmark_metrics = load_benchmark_metrics(cached_meta)

        # Build pretty metadata boxes matching Performance page style
        meta_boxes = [
            html.Div(
                [
                    html.Div(label, className="info-label"),
                    html.Div(str(cached_meta.get(key, "")), className="info-value")
                ],
                className="info-box"
            )
            for key, label in [
                ("dataset", "Dataset"),
                ("max_steps", "Max Steps"),
                ("model_size", "Model Size"),
                ("number_of_nodes", "Number of Nodes")
            ]
        ]
        
        # Create benchmark metric boxes separately (for second row)
        benchmark_labels = {
            "loss": "Benchmark Loss",
            "throughput": "Benchmark Throughput",
            "communication": "Benchmark Communication"
        }
        
        # Format values for display
        def format_benchmark_value(key, value):
            if key == "loss":
                return f"{value:.2f}"
            elif key in ["communication", "throughput"]:
                return f"{value:,}"
            else:
                return str(value)
        
        benchmark_boxes = []
        for key, value in benchmark_metrics.items():
            label = benchmark_labels.get(key, key.replace("_", " ").title())
            formatted_value = format_benchmark_value(key, value)
            benchmark_boxes.append(
                html.Div(
                    [
                        html.Div(label, className="info-label"),
                        html.Div(formatted_value, className="info-value")
                    ],
                    className="info-box"
                )
            )
        
        # Return both rows wrapped in a container
        meta_boxes_container = html.Div([
            html.Div(meta_boxes, className="info-boxes-row"),
            html.Div(benchmark_boxes, className="info-boxes-row", style={"marginTop": "1rem"})
        ])

        coldefs = []
        if filtered_cached_df.empty:
            row_data = []
        else:
            for c in filtered_cached_df.columns:
                if c == "Gist URL":
                    coldefs.append({
                        "field": c,
                        "sortable": True,
                        "filter": True,
                        "resizable": True,
                        "tooltipField": "Gist URL Tooltip",      # <-- show full URL
                        "cellRenderer": "markdown",              # keep links clickable
                        "minWidth": 150,
                        "maxWidth": 150,                          # fixed width
                    })
                elif c == "Gist URL Tooltip":
                    continue
                else:
                    coldefs.append({"field": c, "sortable": True, "filter": True, "resizable": True})
            row_data = filtered_cached_df.to_dict("records")

        last_updated_text = f"Last updated: {pd.Timestamp.utcnow().tz_convert('Africa/Cairo').strftime('%Y-%m-%d %H:%M:%S %Z%z')}"
        return meta_boxes_container, row_data, coldefs, last_updated_text, cached_current_block, all_blocks
    except Exception as e:
        return [], [],  [], f"Error loading data: {e}", 0, []


if __name__ == "__main__":
    app.run(debug=False, port=22555)
