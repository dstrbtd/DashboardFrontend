from influxdb_client import InfluxDBClient
import pandas as pd

# DOES NOT WORK PROPERLY

def simple_check_measurement(query_api, measurement: str):
    flux = f'''
    from(bucket: "distributed-training-metrics")
      |> range(start: -1d)
      |> filter(fn: (r) => r._measurement == "{measurement}")
      |> limit(n: 10)
    '''
    print("Running simplified Flux query:")
    print(flux)
    df = query_api.query_data_frame(flux)
    if not isinstance(df, pd.DataFrame):
        print("Query did not return a DataFrame.")
        return pd.DataFrame()
    return df

if __name__ == "__main__":
    url = "http://161.97.156.125:8086"
    token = "JCDOYKFbiC13zdgbTQROpyvB69oaUWvO4pRw_c3AEYhTjU998E_X_oIJJOVAW24nAE0WYxMwIgdFSLZg8aeV-g=="
    org = "distributed-training"
    timeout=260_000

    client = InfluxDBClient(url=url, token=token, org=org, timeout=timeout)
    query_api = client.query_api()

    measurement_name = "training_metrics"

    df = simple_check_measurement(query_api, measurement_name)

    print("\nReturned DataFrame columns:")
    print(df.columns.tolist())
    print("\nDataFrame head:")
    print(df.head())

    if df.empty:
        print("\n⚠ No raw data found for measurement.")
    else:
        print("\n✅ Raw data returned successfully.")
