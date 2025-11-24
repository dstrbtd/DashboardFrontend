import os
import dash
import dash_ag_grid as dag
import pandas as pd
import numpy as np

from dash import html, dcc, Input, Output, State
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

client = InfluxDBClient(url=INFLUXDB_URL, token=INFLUXDB_TOKEN, org=INFLUXDB_ORG)
query_api = client.query_api()

def get_latest_uid_tracker():
    query = f'''from(bucket: "{INFLUXDB_BUCKET}") 
    |> range(start: -360m)
    |> filter(fn: (r) => r._measurement == "miner_scores") 
    |> filter(fn: (r) => r.validator_uid == "25") 
    |> group(columns: ["miner_uid", "_field"]) 
    |> sort(columns: ["_time"], desc: true)
    |> limit(n: 1)
    |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")'''
    tables = query_api.query_data_frame(query)
    tables = pd.concat(tables) if isinstance(tables, list) else tables
    last_updated_time = pd.Timestamp(tables["_time"].iloc[0])

    # Drop metadata columns
    tables = tables.drop(columns=["result", "table", "_start", "_stop", "_time", "uid"])
    tables = tables.rename(columns={"miner_uid": "uid"})

    tables = tables.sort_values(by="total.score", ascending=False)

    # Format floatsm
    float_cols = tables.select_dtypes(include=['float', 'float64']).columns
    for col in float_cols:
        tables[col] = tables[col].apply(lambda x: f"{x:.4f}" if isinstance(x, (int, float)) else x)

    return tables.fillna("").astype(str), last_updated_time

def get_latest_timestamp():
    query = f'''
    from(bucket: "{INFLUXDB_BUCKET}")
      |> range(start: -45m)
      |> filter(fn: (r) => r._measurement == "miner_scores")
      |> filter(fn: (r) => r.validator_uid == "25")
      |> keep(columns: ["_time", "_field", "_value"])
      |> sort(columns: ["_time"], desc: true)
      |> limit(n: 1)
      |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
    '''
    df = query_api.query_data_frame(query)
    if df.empty:
        return None
    # df["_time"] will be timezone-aware

    ts = pd.to_datetime(df["_time"].iloc[0])

    # Ensure SAME timezone as get_latest_uid_tracker()
    return ts

# Global cache
cached_df, cached_last_updated_time = get_latest_uid_tracker()
print(cached_last_updated_time)

app = dash.Dash(__name__)
app.title = "Mechanism 0 Metrics Dashboard"

# Define column groups with collapsibility using dashGridOptions
column_defs = [
    {
        "headerName": "UID Metadata",
        "children": [
            {
                "field": "uid",
                "headerName": "UID",
                # "filter": "agSetFilter",  # checkbox list filter
                # "floatingFilter": True,         # small search box under header
                # "filterParams": {
                #     "values": None,             # auto-populate from rowData
                #     # "excelMode": "windows",     # Excel-style checkboxes
                #     "suppressMiniFilter": False # allow search in filter menu
                # }
            },
            {"field": "all_reduce.peer_id", "headerName": "Peer ID", "columnGroupShow": "open"},
            {"field": "chaindata.last_updated_block", "headerName": "Metadata Last Updated", "columnGroupShow": "open"},
            {"field": "train.updated_time", "headerName": "Train Score Last Updated", "columnGroupShow": "open"},
            {"field": "train.revision", "headerName": "Train Score Last Revision", "columnGroupShow": "open"},
        ]
    },
    {
        "headerName": "Total Scores",
        "children": [
            {"field": "total.score", "columnGroupShow": "closed"},
        ]
    },
    {
        "headerName": "Train Scores",
        "children": [
            {"field": "train.score", "headerName": "Train Score"},
            {"field": "train.is_valid", "headerName": "Valid Score"},
            {
                "headerName": "Random Scores",
                "children": [
                    {"field": "train.random.score", "headerName": "Random Score"},
                    {"field": "train.random.before", "headerName": "Random Before", "columnGroupShow": "open"},
                    {"field": "train.random.after", "headerName": "Random After", "columnGroupShow": "open"},
                    {"field": "train.random.absolute", "headerName": "Random Absolute", "columnGroupShow": "open"},
                    {"field": "train.random.relative", "headerName": "Random Relative", "columnGroupShow": "open"},
                    {"field": "train.openskill_rating.mu", "headerName": "Random µ", "columnGroupShow": "open"},
                    {"field": "train.openskill_rating.sigma", "headerName": "Random σ", "columnGroupShow": "open"},
                ],
                "columnGroupShow": "closed"
            },
            {
                "headerName": "Assigned Scores",
                "children": [
                    {"field": "train.assigned.score", "headerName": "Assigned Score"},
                    {"field": "train.assigned.before", "headerName": "Assigned Before", "columnGroupShow": "open"},
                    {"field": "train.assigned.after", "headerName": "Assigned After", "columnGroupShow": "open"},
                    {"field": "train.assigned.absolute", "headerName": "Assigned Absolute", "columnGroupShow": "open"},
                    {"field": "train.assigned.relative", "headerName": "Assigned Relative", "columnGroupShow": "open"},
                ],
                "columnGroupShow": "closed"
            },
        ],
    },
    {
        "headerName": "AllReduce Scores",
        "children": [
            {"field": "all_reduce.score", "headerName": "All Reduce Score"},
            {"field": "all_reduce.count", "headerName": "All Reduce Count", "columnGroupShow": "open"},
        ],
    },
]

app.layout = html.Div([ 
    html.Div([
        html.Div("Select UIDs:", 
                 style={
                    "color": "white",
                    "marginRight": "10px",   # remove fixed width, just margin
                    "whiteSpace": "nowrap"   # prevent wrapping
                }),
        dcc.Dropdown(
            id="uid-filter",
            options=[{"label": str(uid), "value": str(uid)} for uid in sorted([int(uid) for uid in cached_df.uid])],
            multi=True,
            placeholder="Choose UIDs...",
            className="dark-dropdown",
            style={"flex": "1"}
        )
    ], style={"display": "flex", "alignItems": "center", "marginBottom": "20px", "flexWrap": "wrap","gap": "10px"}),   # add spacing between label and dropdow

    dag.AgGrid(
        id="metrics-grid",
        columnDefs=column_defs,
        rowData=cached_df.to_dict("records"),
        defaultColDef={
            "sortable": True,
            "resizable": True,
            "floatingFilter": True,
            "cellStyle": {
                "display": "flex",
                "justifyContent": "center",
                "alignItems": "center",
                "textAlign": "center"
            }
        },
        dashGridOptions={
            "suppressFieldDotNotation": True,
            "sideBar": {"toolPanels": ["filters"]}  # optional filter sidebar
        },
        style={"height": "90%", "width": "100%", "marginBottom": "20px"},
        className="ag-theme-alpine-dark"
    ),
    html.Div(f"Last updated: {cached_last_updated_time.tz_convert('Africa/Cairo').strftime('%Y-%m-%d %H:%M:%S %Z%z')}", id="last-updated", className="last-updated"),
    
    dcc.Interval(id="interval", interval=10 * 1000, n_intervals=0),
], className="app-container")


@app.callback(
    Output("metrics-grid", "rowData"),
    Output("last-updated", "children"),
    Input("uid-filter", "value"),
    Input("interval", "n_intervals"),
)
def filter_and_reload_data(selected_uids, n_intervals):
    print("Reload triggered by dropdown or timer")
    print("Selected UIDs:", selected_uids)

    global cached_df, cached_last_updated_time
    
    try:

        latest_time = get_latest_timestamp()

        # Only reload from InfluxDB if the timestamp changed
        if (cached_df.empty) or (latest_time is None) or (latest_time != cached_last_updated_time):
            df, last_updated_time = get_latest_uid_tracker()
            df = df.reset_index(drop=True)
            cached_df = df
            cached_last_updated_time = last_updated_time
            print("Cache refreshed from InfluxDB")
            print(f"last_updated_time {last_updated_time}")
        else:
            df = cached_df
            print("Using cached data")

        # Apply UID filtering
        if selected_uids:
            df = df[df["uid"].isin(selected_uids)]

        return df.to_dict("records"), f"Last updated: {cached_last_updated_time.tz_convert('Africa/Cairo').strftime('%Y-%m-%d %H:%M:%S %Z%z')}"

    except Exception as e:
        print("Reload error:", e)
        return [], f"Last updated: error ({e})"

if __name__ == "__main__":
    app.run(debug=False, port=22177)
