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
INFLUXDB_TOKEN = os.getenv("INFLUXDB_TOKEN")
INFLUXDB_ORG = os.getenv("INFLUXDB_ORG")
INFLUXDB_BUCKET = os.getenv("INFLUXDB_BUCKET")
INFLUXDB_MEASUREMENT = "mechanism1_metrics"

client = InfluxDBClient(url=INFLUXDB_URL, token=INFLUXDB_TOKEN, org=INFLUXDB_ORG)
query_api = client.query_api()

def shorten_middle(value, prefix=10, suffix=10):
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
    query = f"""
    from(bucket: "{INFLUXDB_BUCKET}")
      |> range(start: -30d)
      |> filter(fn: (r) => r._measurement == "{INFLUXDB_MEASUREMENT}")
      |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
    """
    query_api.query(query)
    df = query_api.query_data_frame(query)

    if isinstance(df, list):
        df = pd.concat(df)
    if df.empty:
        return pd.DataFrame(), {}

    df["current_block"] = df["current_block"].fillna(0).astype(int)
    latest_current_block = df["current_block"].max()
    if current_block is None:
        current_block = latest_current_block

    filtered_df = df[df["current_block"] == current_block]

    # Drop metadata columns added by InfluxDB
    filtered_df = filtered_df.drop(columns=[c for c in filtered_df.columns if c in ["result", "table", "_start", "_stop", "_measurement"]], errors="ignore")

    # Make sure _time is datetime and sorted
    filtered_df["_time"] = pd.to_datetime(filtered_df["_time"]).dt.tz_convert("UTC")

    # -----------------------------
    # Extract shared metadata
    # -----------------------------
    metadata_fields = ["dataset", "max_steps", "model_size", "number_of_nodes"]

    # Assume all rows share the same values → take first row
    metadata = {field: filtered_df[field].iloc[0] for field in metadata_fields if field in filtered_df.columns}

    # Remove metadata from table view
    filtered_df = filtered_df.drop(columns=metadata_fields+["current_block"], errors="ignore")

    # Final display format for time (no seconds/ms)
    filtered_df["_time"] = filtered_df["_time"].dt.strftime("%Y-%m-%d %H:%M")

    # Shorten long strings
    if "hotkey" in filtered_df.columns:
        filtered_df["hotkey"] = filtered_df["hotkey"].apply(shorten_middle)

    # Round score to 4 decimal places if present
    if "score" in filtered_df.columns:
        filtered_df["score"] = filtered_df["score"].round(4)

    # Round loss to 4 decimal places if present
    if "loss" in filtered_df.columns:
        filtered_df["loss"] = filtered_df["loss"].round(4)

    filtered_df = filtered_df.sort_values(by="score", ascending = False)

    # Rsename columns
    rename_map = {
        "_time": "Time",
        "uid": "UID",
        "hotkey": "Hotkey",
        "gist_url": "Gist URL",
    }
    filtered_df = filtered_df.rename(columns=rename_map)

    # Make Gist Url clickable (Markdown)
    if "Gist URL" in filtered_df.columns:
        filtered_df["Gist URL Tooltip"] = filtered_df["Gist URL"]

        filtered_df["Gist URL"] = filtered_df["Gist URL"].apply(
            lambda u: f"[{u}]({u})" if isinstance(u, str) and u else ""
        )

    return df, filtered_df, metadata, current_block


# Cache for performance
cached_df, filtered_cached_df, cached_meta, cached_current_block = load_mechanism1_metrics()


# ------------------------------
# Dash App
# ------------------------------
app = dash.Dash(__name__)
app.title = "Mechanism 1 Metrics Dashboard"

app.layout = html.Div([
    html.Div(
        id="meta-boxes",
        style={
            "display": "flex",
            "flexWrap": "wrap",
            "gap": "20px",
            "marginBottom": "20px",
            "color": "white",
            "width": "100%"
        }
    ),

    html.Div([
        html.Div("Select UIDs:",
                 style={
                    "color": "white",
                    "marginRight": "10px",   # remove fixed width, just margin
                    "whiteSpace": "nowrap"   # prevent wrapping
                }),
        dcc.Dropdown(
            id="current_block_dropdown",
            options=[{"label": str(b), "value": b} for b in sorted(cached_df["current_block"].unique(), reverse=True)],
            multi=False,
            value=cached_current_block,
            className="dark-dropdown",
            style={"flex": "1"}
        )
    ], style={"display": "flex", "alignItems": "center", "marginBottom": "20px", "flexWrap": "wrap","gap": "10px"}),   # add spacing between label and dropdow

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

    html.Div(id="last-updated", style={"color": "white", "marginTop": "10px"}),

    dcc.Interval(id="refresh", interval=10 * 1000, n_intervals=0)
], style={"backgroundColor": "black", "padding": "20px"})


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
        df, filtered_df, meta, current_block = load_mechanism1_metrics(selected_block)
        if not df.empty:
            cached_df, filtered_cached_df, cached_meta, cached_current_block = df, filtered_df, meta, current_block
        all_blocks = [{"label": str(b), "value": b} for b in sorted(cached_df["current_block"].unique(), reverse=True)]

        # If user cleared the selection or it's missing → auto-select the latest
        if selected_block is None:
            selected_block = cached_current_block
        elif selected_block not in all_blocks:
            selected_block = cached_current_block

        _, filtered_cached_df, cached_meta, _ = load_mechanism1_metrics(selected_block)

        # Build pretty metadata boxes
        meta_boxes = [
            html.Div(
                [
                    html.Div(label, style={
                        "fontWeight": "700",
                        "fontSize": "14px",
                        "marginBottom": "4px",      # 🔹 small space under title
                        "letterSpacing": "0.03em",  # optional: slightly spaced letters
                        "textTransform": "uppercase"  # optional: ALL CAPS}),
                    }),
                    html.Div(str(cached_meta.get(key, "")), style={"fontWeight": "500", "fontSize": "18px"})
                ],
                style={
                    "border": "1px solid #555",
                    "borderRadius": "8px",
                    "padding": "10px 15px",
                    "minWidth": "150px",
                    "textAlign": "center",
                    "backgroundColor": "#111",
                    "flex": 1
                }
            )
            for key, label in [
                ("dataset", "Dataset"),
                ("max_steps", "Max Steps"),
                ("model_size", "Model Size"),
                ("number_of_nodes", "Number of Nodes")
            ]
        ]

        coldefs = []
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

        return meta_boxes, filtered_cached_df.to_dict("records"), coldefs, f"Last updated: {pd.Timestamp.utcnow()}", cached_current_block, all_blocks
    except Exception as e:
        return [], [],  [], f"Error loading data: {e}", 0, []


if __name__ == "__main__":
    app.run(debug=False, port=22555)
