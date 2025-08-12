from influxdb_client import InfluxDBClient

# === InfluxDB connection ===
INFLUXDB_URL = "http://161.97.156.125:8086"
#INFLUXDB_TOKEN = "JCDOYKFbiC13zdgbTQROpyvB69oaUWvO4pRw_c3AEYhTjU998E_X_oIJJOVAW24nAE0WYxMwIgdFSLZg8aeV"
INFLUXDB_TOKEN = "JCDOYKFbiC13zdgbTQROpyvB69oaUWvO4pRw_c3AEYhTjU998E_X_oIJJOVAW24nAE0WYxMwIgdFSLZg8aeV-g=="
INFLUXDB_ORG = "distributed-training"
INFLUXDB_BUCKET = "distributed-training-metrics"
INFLUXDB_MEASUREMENT = "evaluation_metrics"

client = InfluxDBClient(url=INFLUXDB_URL, token=INFLUXDB_TOKEN, org=INFLUXDB_ORG)
query_api = client.query_api()

# === Query last year’s data for evaluation_metrics ===
query = f"""
from(bucket: "{INFLUXDB_BUCKET}")
  |> range(start: -365d)
  |> filter(fn: (r) => r._measurement == "{INFLUXDB_MEASUREMENT}")
  |> sort(columns: ["_time"])
"""

results = query_api.query(org=INFLUXDB_ORG, query=query)

# # === Print in a table ===
# print(f"{'TAG':<10} {'TASK':<15} {'SCORE':<10} {'TIME'}")
# print("-" * 60)

# for table in results:
#     for record in table.records:
#         tag = record.values.get("tag")
#         task = record.values.get("task")
#         score = record.get_value()
#         time = record.get_time()
#         print(f"{tag:<10} {task:<15} {score:<10.4f} {time}")

records_list = []

for table in results:
    for record in table.records:
        tag = record.values.get("tag")
        task = record.values.get("task")
        score = record.get_value()
        time = record.get_time()
        # Extract the number after the dot, e.g. "6.10" -> 10 as int
        try:
            number_part = float(tag.split('.')[1])
        except (IndexError, ValueError):
            number_part = float('inf')  # or 0 or some default if parsing fails
        records_list.append((number_part, tag, task, score, time))

# Sort by number_part ascending
records_list.sort(key=lambda x: x[0])

# Print header
print(f"{'TAG':<10} {'TASK':<15} {'SCORE':<10} {'TIME'}")
print("-" * 60)

# Print sorted
for _, tag, task, score, time in records_list:
    print(f"{tag:<10} {task:<15} {score:<10.4f} {time}")
