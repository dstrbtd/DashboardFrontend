from influxdb_client import InfluxDBClient
import pandas as pd

# === Setup ===
client = InfluxDBClient(
    url="http://161.97.156.125:8086",
    token="a62bc7211beca367fcdd0b5a16b82b0f565447b6f7212d3de9c615068b787383",
    org="distributed-training"
)

query_api = client.query_api()

# === Summary Function ===
def summarize_measurement(measurement, time_range='-1h'):
    flux = f'''
    from(bucket: "distributed-training-metrics")
      |> range(start: {time_range})
      |> filter(fn: (r) => r._measurement == "{measurement}")
      |> group(columns: ["_field"])
      |> count()
      |> group()
      |> keep(columns: ["_field", "_value"])
      |> sort(columns: ["_value"], desc: true)
    '''
    df = query_api.query_data_frame(flux)
    if not isinstance(df, pd.DataFrame):
        return pd.DataFrame()
    df = df.rename(columns={"_field": "field", "_value": "count"})
    return df

# === Run Summary for Each Measurement ===
summary_meta     = summarize_measurement("metagraph_metrics")
summary_train    = summarize_measurement("training_metrics")
summary_resource = summarize_measurement("resource_metrics")
summary_network  = summarize_measurement("network_metrics")

# === Print Summaries ===
for name, df in {
    "metagraph_metrics": summary_meta,
    "training_metrics": summary_train,
    "resource_metrics": summary_resource,
    "network_metrics": summary_network,
}.items():
    print(f"\n=== {name} ===")
    print(f"Total fields: {len(df)}")
    print(df.head(5))

# === Save to CSVs (Optional) ===
summary_meta.to_csv("summary_metagraph.csv", index=False)
summary_train.to_csv("summary_training.csv", index=False)
summary_resource.to_csv("summary_resource.csv", index=False)
summary_network.to_csv("summary_network.csv", index=False)
