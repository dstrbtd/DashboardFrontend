import bittensor as bt
import requests
import json
from time import sleep
from influxdb_client import InfluxDBClient
import pandas as pd

# ---- InfluxDB Config ----
INFLUXDB_URL = "http://161.97.156.125:8086"
INFLUXDB_TOKEN = "648b65eb0a5b1d7b48e71e695fd6bb6611936548debaf281cf438df8ce03b74b"
INFLUXDB_ORG = "distributed-training"
INFLUXDB_BUCKET = "distributed-training-metrics"

client = InfluxDBClient(url=INFLUXDB_URL, token=INFLUXDB_TOKEN, org=INFLUXDB_ORG)
query_api = client.query_api()

def get_latest_usernames(validator_uid="25") -> dict:
    """
    Returns a dictionary {uid: username} for the latest train.model_id entries.
    """
    query = f'''
    from(bucket: "{INFLUXDB_BUCKET}")
      |> range(start: -120m)
      |> filter(fn: (r) => r._measurement == "miner_scores")
      |> filter(fn: (r) => r.validator_uid == "{validator_uid}")
      |> group(columns: ["miner_uid", "_field"])
      |> sort(columns: ["_time"], desc: true)
      |> limit(n: 1)
      |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
    '''

    tables = query_api.query_data_frame(query)
    if isinstance(tables, list):
        df = pd.concat(tables)
    else:
        df = tables

    if df.empty:
        return {}

    df = df[["miner_uid", "train.model_id"]].drop_duplicates(subset="miner_uid")

    uid_usernames = {}
    for uid, model_id in zip(df["miner_uid"].astype(str), df["train.model_id"].astype(str)):
        if model_id.lower() != "nan" and "/" in model_id:
            username = model_id.split("/")[0]
        else:
            username = model_id
        uid_usernames[uid] = username
    return uid_usernames

# ---- Bittensor Miners ----
def get_miners_with_coordinates_and_usernames(netuid: int = 38, network: str = "finny") -> list[dict]:
    """
    Returns a list of miners with UID, IP, username (from model_id), and coordinates [lat, lon].
    If username not found, uses "stillUnknown".
    """
    # Get latest usernames from InfluxDB
    uid_usernames = get_latest_usernames()

    metagraph = bt.metagraph(netuid=netuid, network=network)
    miners_list = []

    for uid in range(metagraph.n):
        ip = metagraph.axons[uid].ip
        if ip == "0.0.0.0":
            continue

        try:
            resp = requests.get(f"https://ipwhois.app/json/{ip}").json()
            lat = resp.get('latitude', 0.0)
            lon = resp.get('longitude', 0.0)
            if lat is None or lon is None:
                lat, lon = 0.0, 0.0
        except Exception as e:
            print(f"IP lookup failed for {ip} (UID {uid}): {e}")
            lat, lon = 0.0, 0.0

        # Replace 'name' with username from InfluxDB, or "stillUnknown" if not present
        username = uid_usernames.get(str(uid), "stillUnknown")

        miners_list.append({
            "name": username,
            "uid": uid,
            "ip": ip,
            "coordinates": [float(lat), float(lon)]
        })

        sleep(0.2)  # prevent hitting API rate limits

    return miners_list

if __name__ == "__main__":
    miners_info = get_miners_with_coordinates_and_usernames()

    with open("miners.json", "w") as f:
        json.dump(miners_info, f, indent=2)

    print(f"Saved {len(miners_info)} miners to miners.json")
