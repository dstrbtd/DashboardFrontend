from influxdb_client import InfluxDBClient
import pandas as pd
import time

def test_allreduce_query(run_id="6", days=1):
    client = InfluxDBClient(
        url="http://161.97.156.125:8086",
        token="JCDOYKFbiC13zdgbTQROpyvB69oaUWvO4pRw_c3AEYhTjU998E_X_oIJJOVAW24nAE0WYxMwIgdFSLZg8aeV-g==",
        org="distributed-training"
    )
    query_api = client.query_api()

    flux = f'''
    from(bucket: "distributed-training-metrics")
      |> range(start: -{days}d)
      |> filter(fn: (r) => r._measurement == "allreduce_operations")
      |> filter(fn: (r) => exists r.epoch and exists r.validator_uid and exists r._value)
      |> filter(fn: (r) => r["run_id"] == "{run_id}")
      |> group(columns: ["validator_uid", "epoch", "run_id", "_field"])
      |> mean()
      |> pivot(rowKey: ["epoch", "validator_uid"], columnKey: ["_field"], valueColumn: "_value")
      |> sort(columns: ["epoch"])
    '''
    start_time = time.time()
    df = query_api.query_data_frame(flux)
    end_time = time.time()

    # Ensure df is always a single DataFrame
    if isinstance(df, list):
        df = pd.concat(df, ignore_index=True)

    if isinstance(df, pd.DataFrame):
        print(f"Query took {end_time - start_time:.2f} seconds")
        print(f"Columns: {df.columns.tolist()}")
        print(df)
    else:
        print("No DataFrame returned:", df)

if __name__ == "__main__":
    print("Testing with days=1")
    test_allreduce_query(days=1)
    print("\nTesting with days=5")
    test_allreduce_query(days=5)
