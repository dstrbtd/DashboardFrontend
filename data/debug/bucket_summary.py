from influxdb_client import InfluxDBClient
import pandas as pd
import warnings
import os
from dotenv import load_dotenv, find_dotenv
from influxdb_client.client.warnings import MissingPivotFunction

warnings.simplefilter("ignore", MissingPivotFunction)

load_dotenv(find_dotenv())

INFLUXDB_URL = os.getenv("INFLUXDB_URL")
INFLUXDB_ORG = os.getenv("INFLUXDB_ORG")
INFLUXDB_BUCKET_MECHANISM_0 = os.getenv("INFLUXDB_BUCKET_MECHANISM_0")
INFLUXDB_TOKEN_MECHANISM_0 = os.getenv("INFLUXDB_TOKEN_MECHANISM_0")

client = InfluxDBClient(
    url=INFLUXDB_URL,
    token=INFLUXDB_TOKEN_MECHANISM_0,
    org=INFLUXDB_ORG
)
query_api = client.query_api()

def list_measurements(bucket=INFLUXDB_BUCKET_MECHANISM_0):
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

def generate_bucket_overview(bucket=INFLUXDB_BUCKET_MECHANISM_0):
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
