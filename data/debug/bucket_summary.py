from influxdb_client import InfluxDBClient
import pandas as pd
import warnings
from influxdb_client.client.warnings import MissingPivotFunction

warnings.simplefilter("ignore", MissingPivotFunction)

client = InfluxDBClient(
    url="http://161.97.156.125:8086",
    token="JCDOYKFbiC13zdgbTQROpyvB69oaUWvO4pRw_c3AEYhTjU998E_X_oIJJOVAW24nAE0WYxMwIgdFSLZg8aeV-g==",
    org="distributed-training"
)
query_api = client.query_api()

def list_measurements(bucket="distributed-training-metrics"):
    flux = f'''
    import "influxdata/influxdb/schema"
    schema.measurements(bucket: "{bucket}")
    '''
    df = query_api.query_data_frame(flux)
    return df._value.tolist() if not df.empty else []

def list_fields(bucket, measurement):
    flux = f'''
    import "influxdata/influxdb/schema"
    schema.fieldKeys(
        bucket: "{bucket}",
        predicate: (r) => r._measurement == "{measurement}"
    )
    '''
    df = query_api.query_data_frame(flux)
    return df._value.tolist() if not df.empty else []

def list_tags(bucket, measurement):
    flux = f'''
    import "influxdata/influxdb/schema"
    schema.tagKeys(
        bucket: "{bucket}",
        predicate: (r) => r._measurement == "{measurement}"
    )
    '''
    df = query_api.query_data_frame(flux)
    return df._value.tolist() if not df.empty else []

def generate_bucket_overview(bucket="distributed-training-metrics"):
    measurements = list_measurements(bucket)
    overview = []

    for m in measurements:
        fields = list_fields(bucket, m)
        tags = list_tags(bucket, m)
        overview.append({
            "measurement": m,
            "fields": ", ".join(fields),
            "tags": ", ".join(tags)
        })

    df = pd.DataFrame(overview)
    
    pd.set_option("display.max_colwidth", None)
    pd.set_option("display.max_rows", None)
    pd.set_option("display.max_columns", None)
    
    return df

def print_measurement_summary(df):
    print("\n==== Measurement Overview ====")
    for i, row in df.iterrows():
        print(f"Measurement: {row['measurement']}")
        print(f"  Fields: {row['fields']}")
        print(f"  Tags  : {row['tags']}")
        print("-" * 80)

if __name__ == "__main__":
    overview_df = generate_bucket_overview()

    print("Measurements:")
    for measurement in overview_df["measurement"].tolist():
        print(f"- {measurement}")

    print_measurement_summary(overview_df)
