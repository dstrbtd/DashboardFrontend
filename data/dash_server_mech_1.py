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

# ------------------------------
# Query Latest Metrics
# ------------------------------
def load_mechanism1_metrics():
    query = f"""
    from(bucket: "{INFLUXDB_BUCKET}")
      |> range(start: -24h)
      |> filter(fn: (r) => r._measurement == "{INFLUXDB_MEASUREMENT}")
      |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
    """
    query_api.query(query)
    df = query_api.query_data_frame(query)


    if isinstance(df, list):
        df = pd.concat(df)
    if df.empty:
        return pd.DataFrame()

    # Drop metadata columns added by InfluxDB
    df = df.drop(columns=[c for c in df.columns if c in ["result", "table", "_start", "_stop"]], errors="ignore")

    # Make sure _time is datetime and sorted
    df["_time"] = pd.to_datetime(df["_time"]).dt.tz_convert("UTC")

    # ✅ Keep only latest row per hotkey
    df = (
        df.sort_values("_time", ascending=False)   # newest first
          .drop_duplicates(subset=["hotkey"], keep="first")
    )

    # Optional: sort by something for display, e.g. loss ascending
    df = df.sort_values("loss")

    return df


# Cache for performance
cached_df = load_mechanism1_metrics()


# ------------------------------
# Dash App
# ------------------------------
app = dash.Dash(__name__)
app.title = "Mechanism 1 Metrics Dashboard"

app.layout = html.Div([
    dag.AgGrid(
        id="subnet1-grid",
        columnDefs=[{"field": c, "sortable": True, "filter": True, "resizable": True}
                    for c in cached_df.columns],
        rowData=cached_df.to_dict("records"),
        className="ag-theme-alpine-dark",
        style={"height": "90vh", "width": "100%"},
        defaultColDef={"minWidth": 120}
    ),

    html.Div(id="last-updated", style={"color": "white", "marginTop": "10px"}),

    dcc.Interval(id="refresh", interval=10 * 1000, n_intervals=0)
], style={"backgroundColor": "black", "padding": "20px"})


# ------------------------------
# Refresh Callback
# ------------------------------
@app.callback(
    Output("subnet1-grid", "rowData"),
    Output("subnet1-grid", "columnDefs"),
    Output("last-updated", "children"),
    Input("refresh", "n_intervals")
)
def reload_data(_):
    global cached_df
    try:
        df = load_mechanism1_metrics()
        if not df.empty:
            cached_df = df

        coldefs = [{"field": c, "sortable": True, "filter": True, "resizable": True}
                   for c in cached_df.columns]

        return cached_df.to_dict("records"), coldefs, f"Last updated: {pd.Timestamp.utcnow()}"
    except Exception as e:
        return [], [], f"Error loading data: {e}"


if __name__ == "__main__":
    app.run(debug=False, port=22555)
