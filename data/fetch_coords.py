import wandb
import requests
import json
from time import sleep

wandb.login()
api = wandb.Api()

runs = api.runs("kmfoda/distributed_training_miners", filters={"state": "running"})

miners_final = []

for run in runs:
    config = run.config
    dht_ip = config.get('dht', {}).get('ip')
    axon_ip = config.get('axon', {}).get('external_ip')
    name = config.get('wallet', {}).get('name')

    if name and dht_ip:
        ip = axon_ip or dht_ip

        try:
            resp = requests.get(f"https://ipwhois.app/json/{ip}").json()
            lat = resp.get('latitude')
            lon = resp.get('longitude')
            if lat is None or lon is None:
                coords = [0, 0]
            else:
                coords = [float(lat), float(lon)]
        except Exception as e:
            print(f"IP lookup failed for {ip}: {e}")
            coords = [0, 0]

        miners_final.append({
            "name": name,
            "ip": ip,
            "coordinates": coords
        })

        sleep(0.2)

with open("miners.json", "w") as f:
    json.dump(miners_final, f, indent=2)

print(f"Saved {len(miners_final)} running miners to miners.json")
