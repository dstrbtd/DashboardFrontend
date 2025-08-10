from influxdb_client import InfluxDBClient
import pandas as pd

client = InfluxDBClient(
    url="http://161.97.156.125:8086",
    token="a62bc7211beca367fcdd0b5a16b82b0f565447b6f7212d3de9c615068b787383",
    org="distributed-training"
)

query_api = client.query_api()

def get_metrics(measurement):
    flux = f'''
    import "influxdata/influxdb/schema"
    from(bucket: "distributed-training-metrics")
      |> range(start: -1m)
      |> filter(fn: (r) => r._measurement == "{measurement}")
      |> last()
      |> schema.fieldsAsCols()
    '''
    df = query_api.query_data_frame(flux)
    if not isinstance(df, pd.DataFrame):
        return pd.DataFrame()
    return df

def clean_df(df, keep_tags=False):
    drop_cols = ['_start', '_stop', '_measurement', 'result', 'table']
    if not keep_tags:
        drop_cols += ['hotkey', 'epoch', 'inner_step']
    return df.drop(columns=[col for col in df.columns if col in drop_cols], errors='ignore')

df_train    = get_metrics("training_metrics")
df_resource = get_metrics("resource_metrics")
df_network  = get_metrics("network_metrics")
df_meta     = get_metrics("metagraph_metrics")

df_all = pd.DataFrame()
if isinstance(df_train, pd.DataFrame) and "miner_uid" in df_train.columns:
    df_all = clean_df(df_train, keep_tags=True)
    if "_time" in df_all.columns:
        df_all = df_all.rename(columns={"_time": "time"})

for df in [df_resource, df_network, df_meta]:
    if isinstance(df, pd.DataFrame) and "miner_uid" in df.columns:
        df_clean = clean_df(df, keep_tags=False)
        df_clean = df_clean.drop(columns=["_time"], errors="ignore")
        df_all = df_all.merge(df_clean, on="miner_uid", how="outer")

columns_to_show = [
    "time",
    # training metrics
    "miner_uid", "hotkey", "epoch", "inner_step",  # tags
    "loss", "samples_accumulated", "samples_per_second",
    # resource metrics
    "cpu_percent", "memory_percent", "gpu_utilization",
    # network metrics
    "bandwidth",
    # metagraph metrics
    "stake", "trust", "consensus", "incentive", "emissions",
]

columns_found = [col for col in columns_to_show if col in df_all.columns]
df_all = df_all[columns_found]

def drop_rows_with_nan_incentive(df):
    """
    Drops rows where the 'incentive' column has NaN values.
    If 'incentive' exists, it also assigns a rank column based on descending order.
    """
    if "incentive" in df.columns:
        df = df.dropna(subset=["incentive"]).copy()
        df["rank"] = df["incentive"].rank(method="min", ascending=False).astype(int)
    return df

def keep_only_most_recent_datapoint_per_uid_per_epoch(df, time_col='time', uid_col='miner_uid', epoch_col='epoch'):
    """Filters the DataFrame to keep only the latest record per (uid, epoch) pair based on the time column."""
    df = df.copy()
    df[time_col] = pd.to_datetime(df[time_col])
    df = df.sort_values(by=[uid_col, epoch_col, time_col], ascending=[True, True, False])
    df = df.drop_duplicates(subset=[uid_col, epoch_col], keep='first').reset_index(drop=True)
    return df

df_all = drop_rows_with_nan_incentive(df_all)
df_all = keep_only_most_recent_datapoint_per_uid_per_epoch(df_all)

df_all.to_csv("miner_all.csv", index=False)
print(df_all)
