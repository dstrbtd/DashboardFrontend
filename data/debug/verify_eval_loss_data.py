from influxdb_client import InfluxDBClient

# === InfluxDB connection ===
INFLUXDB_URL = "http://161.97.156.125:8086"
#INFLUXDB_TOKEN = "JCDOYKFbiC13zdgbTQROpyvB69oaUWvO4pRw_c3AEYhTjU998E_X_oIJJOVAW24nAE0WYxMwIgdFSLZg8aeV"
INFLUXDB_TOKEN = "JCDOYKFbiC13zdgbTQROpyvB69oaUWvO4pRw_c3AEYhTjU998E_X_oIJJOVAW24nAE0WYxMwIgdFSLZg8aeV-g=="
INFLUXDB_ORG = "distributed-training"
INFLUXDB_BUCKET = "distributed-training-metrics"
INFLUXDB_MEASUREMENT = "evaluation_metrics"

client = InfluxDBClient(
    url=INFLUXDB_URL,
    token=INFLUXDB_TOKEN,
    org=INFLUXDB_ORG,
    timeout=60000  # timeout in milliseconds (60 seconds)
)
query_api = client.query_api()

# === Query last year’s data for evaluation_metrics ===
query = f"""
from(bucket: "{INFLUXDB_BUCKET}")
  |> range(start: -365d)
  |> filter(fn: (r) => r._measurement == "{INFLUXDB_MEASUREMENT}")
  |> filter(fn: (r) => r.task == "fineweb")
  |> unique(column: "tag")                  // keep only 1 per tag
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
        # Extract run_id and epoch
        try:
            parts = tag.split('.')
            run_id = int(parts[0])
            epoch = int(parts[1])
        except (IndexError, ValueError):
            run_id = float('inf')
            epoch = float('inf')
        records_list.append((run_id, epoch, tag, task, score, time))

# Sort by run_id first, then epoch
records_list.sort(key=lambda x: (x[0], x[1]))

# Print header
print(f"{'TAG':<10} {'TASK':<15} {'SCORE':<10} {'TIME'}")
print("-" * 60)

# Print sorted
for _, _, tag, task, score, time in records_list:
    print(f"{tag:<10} {task:<15} {score:<10.4f} {time}")
