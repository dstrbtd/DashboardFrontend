from influxdb_client import InfluxDBClient
import pandas as pd

client = InfluxDBClient(
    url="http://161.97.156.125:8086",
    token="JCDOYKFbiC13zdgbTQROpyvB69oaUWvO4pRw_c3AEYhTjU998E_X_oIJJOVAW24nAE0WYxMwIgdFSLZg8aeV-g==",
    org="distributed-training"
)

query_api = client.query_api()

def get_raw_miner_scores(measurement):
    flux = f'''
    from(bucket: "distributed-training-metrics")
      |> range(start: -1d)  // Go back further to be sure
      |> filter(fn: (r) => r._measurement == "{measurement}")
      |> limit(n: 10)
    '''
    return query_api.query_data_frame(flux)

# df_raw = get_raw_miner_scores("miner_scores")
# print(df_raw.head(20))
# print("\nAvailable columns in raw df:\n", df_raw.columns)


df_raw_list = get_raw_miner_scores("miner_scores")

# Combine into one DataFrame
df_raw = pd.concat(df_raw_list) if isinstance(df_raw_list, list) else df_raw_list

print(df_raw.head(20))
print("\nAvailable columns in raw df:\n", df_raw.columns)

