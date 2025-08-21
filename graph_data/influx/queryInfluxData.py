from influxdb_client import InfluxDBClient
import pandas as pd
import numpy as np
import os
import json
import warnings
from influxdb_client.client.warnings import MissingPivotFunction
from datetime import datetime, timezone
import time
import bittensor as bt

warnings.simplefilter("ignore", MissingPivotFunction)

counter = 0

def get_active_miners() -> int:
    metagraph = bt.metagraph(netuid=38)
    active_miners = len([
        x for x in range(metagraph.n)
        if metagraph.axons[x].ip != "0.0.0.0" and metagraph.stake[x] <= 1000
    ])
    return active_miners

# -----------------------------------------
# Helper to get latest run_id dynamically
# -----------------------------------------
def get_latest_run_id_from_validator_metrics(days: int = 7) -> str:
    """
    Query recent validator allreduce_operations to find the highest run_id
    seen in the last `days` days, returned as string.
    """
    client = InfluxDBClient(
        url="http://161.97.156.125:8086",
        token="JCDOYKFbiC13zdgbTQROpyvB69oaUWvO4pRw_c3AEYhTjU998E_X_oIJJOVAW24nAE0WYxMwIgdFSLZg8aeV-g==",
        org="distributed-training",
        timeout=60_000
    )
    query_api = client.query_api()

    flux = f'''
    from(bucket: "distributed-training-metrics")
      |> range(start: -{days}d)
      |> filter(fn: (r) => r._measurement == "allreduce_operations")
      |> filter(fn: (r) => exists r.run_id)
      |> keep(columns: ["run_id"])
      |> group()
      |> distinct(column: "run_id")
      |> sort(columns: ["run_id"], desc: true)
      |> limit(n:1)
    '''

    results = query_api.query(org="distributed-training", query=flux)

    for table in results:
        for record in table.records:
            max_run_id = record.values.get("_value")
            if max_run_id is not None:
                return str(max_run_id)

    # fallback default run_id
    return "6"


# -----------------------------------------
# 1. Losses Data Retrieval
# ----------------------------------------
def get_global_model_losses_influx_data(run_id: str) -> dict:
    """
    Retrieve outer_steps vs. losses for fineweb task for given run_id.
    Matches exact run_id.0.0 and run_id.x tags.
    """
    client = InfluxDBClient(
        url="http://161.97.156.125:8086",
        token="JCDOYKFbiC13zdgbTQROpyvB69oaUWvO4pRw_c3AEYhTjU998E_X_oIJJOVAW24nAE0WYxMwIgdFSLZg8aeV-g==",
        org="distributed-training"
    )
    query_api = client.query_api()

    query = f"""
    import "strings"
    from(bucket: "distributed-training-metrics")
        |> range(start: -365d)
        |> filter(fn: (r) => r._measurement == "evaluation_metrics")
        |> filter(fn: (r) => r.tag == "{run_id}.0.0" or r.tag =~ /^{run_id}\./)
        |> filter(fn: (r) => r.task == "fineweb")
        |> map(fn: (r) => ({{
                r with outer_step: int(v: strings.split(v: r.tag, t: ".")[1])
            }}))
        |> group(columns: ["outer_step"])
        |> sort(columns: ["_time"], desc: true)  // newest first
        |> unique(column: "outer_step")          // keep only 1 per step
        |> sort(columns: ["outer_step"])         // re-sort by step ascending
    """

    results = query_api.query(org="distributed-training", query=query)

    records_list = []
    for table in results:
        for record in table.records:
            tag = record.values.get("tag")
            task = record.values.get("task")
            score = record.get_value()
            time = record.get_time()
            try:
                number_part = float(tag.split('.')[1])
            except (IndexError, ValueError):
                number_part = float('inf')
            records_list.append((number_part, tag, task, score, time))

    records_list.sort(key=lambda x: x[0])

    outer_steps = []
    losses = []
    for _, tag, task, score, time in records_list:
        try:
            outer_step = int(float(tag.split('.')[1]))
        except Exception:
            outer_step = None
        if outer_step is not None:
            outer_steps.append(outer_step)
            losses.append(score)

    return {
        "outer_steps": outer_steps,
        "losses": losses,
    }


def get_miner_and_validator_influx_data(run_id: str = "6", epoch: int = 0, days: int = 30) -> dict:
    """
    Retrieve miner and validator training metrics for given run_id,
    with configurable time range (in days).
    """
    global counter
    counter += 1

    client = InfluxDBClient(
        url="http://161.97.156.125:8086",
        token="JCDOYKFbiC13zdgbTQROpyvB69oaUWvO4pRw_c3AEYhTjU998E_X_oIJJOVAW24nAE0WYxMwIgdFSLZg8aeV-g==",
        org="distributed-training",
        timeout=260_000
    )
    query_api = client.query_api()

    def ensure_dataframe(df):
        """Ensure the result is always a single DataFrame."""
        if isinstance(df, list):
            df = pd.concat(df, ignore_index=True)
        return df if isinstance(df, pd.DataFrame) else pd.DataFrame()

    def get_miner_training_metrics(run_id: str, epoch: int, days: int):
        flux = f'''
        from(bucket: "distributed-training-metrics")
            |> range(start: -{days}d)
            |> filter(fn: (r) => r._measurement == "training_metrics")
            |> filter(fn: (r) => r._field == "loss")
            |> filter(fn: (r) => r["run_id"] == "{run_id}")
            |> group(columns: ["miner_uid", "epoch", "run_id"])
            |> mean()
        '''
        return ensure_dataframe(query_api.query_data_frame(flux))

    def get_validator_allreduce_operations_metrics(run_id: str, epoch: int, days: int):
        flux = f'''
        from(bucket: "distributed-training-metrics")
            |> range(start: -{days}d)
            |> filter(fn: (r) => r._measurement == "allreduce_operations")
            |> filter(fn: (r) => exists r.epoch and exists r.validator_uid and exists r._value)
            |> filter(fn: (r) => r["run_id"] == "{run_id}")
            |> filter(fn: (r) => int(v: r.epoch) <= {epoch})
            |> filter(fn: (r) => r["validator_uid"] == "25")
            |> drop(columns: ["_start", "_stop"])
            |> group(columns: ["validator_uid", "epoch", "run_id", "_field"])
            |> max()
            |> pivot(rowKey: ["epoch", "validator_uid"], columnKey: ["_field"], valueColumn: "_value")
            |> sort(columns: ["epoch"])
        '''
        return ensure_dataframe(query_api.query_data_frame(flux))

    # --- Miner metrics ---
    start_time = time.time()
    df_train = get_miner_training_metrics(run_id, epoch, days).rename(columns={"_value": "loss"})
    print("df_train columns:", df_train.columns.tolist())
    print(df_train.head())
    print(f"Time miner training metrics: {time.time() - start_time:.2f} seconds")

    columns_needed = ["miner_uid", "run_id", "epoch", "loss"]
    df_clean_miner = (
        df_train[columns_needed]
        .dropna(subset=columns_needed)
        .reset_index(drop=True)
    )
    df_clean_miner = df_clean_miner[df_clean_miner["loss"] > 0.0]
    df_clean_miner["epoch"] = df_clean_miner["epoch"].astype(int)
    df_clean_miner = df_clean_miner.sort_values(by=["epoch", "miner_uid"]).reset_index(drop=True)

    # --- Validator metrics ---
    start_time = time.time()
    df_allreduce = get_validator_allreduce_operations_metrics(run_id, epoch, days)
    print("Allreduce columns:", df_allreduce.columns.tolist())
    print(df_allreduce.head())

    print(f"Time validator allreduce metrics: {time.time() - start_time:.2f} seconds")

    columns_needed_vali = ["validator_uid", "epoch", "participating_miners", "learning_rate", "failed_miners"]
    df_clean_vali = (
        df_allreduce[columns_needed_vali]
        .dropna(subset=["validator_uid", "epoch", "participating_miners"])  # don't drop NaNs in learning_rate
        .reset_index(drop=True)
    )
    df_clean_vali["participating_miners"] = df_clean_vali["participating_miners"].round().astype(int)
    df_clean_vali["succesful_miners"] = df_clean_vali["participating_miners"].astype(int) - df_clean_vali["failed_miners"].fillna(0).astype(int)
    df_clean_vali["epoch"] = df_clean_vali["epoch"].astype(int)
    df_clean_vali["run_id"] = run_id
    df_clean_vali = df_clean_vali[["validator_uid", "run_id", "epoch", "participating_miners", "learning_rate", "succesful_miners"]]
    df_clean_vali = df_clean_vali.sort_values("epoch").reset_index(drop=True)

    # Merge miner + validator data
    df_merged = pd.merge(df_clean_miner, df_clean_vali, on="epoch", how="outer")
    df_merged = df_merged.sort_values(by="epoch").reset_index(drop=True)

    # Random sample of miners for display
    unique_miners = df_merged["miner_uid"].dropna().unique()
    num_miners_to_sample = min(10, len(unique_miners))
    random_miners = np.random.choice(unique_miners, size=num_miners_to_sample, replace=False) if len(unique_miners) else []

    df_filtered = df_merged[df_merged["miner_uid"].isin(random_miners)]

    miners_dict = {
        str(miner_uid): {
            "epoch": group["epoch"].tolist(),
            "loss": group["loss"].tolist()
        }
        for miner_uid, group in df_filtered.groupby("miner_uid")
    }

    validators_dict = {
        str(validator_uid): {
            "peers": {
                "epoch": group["epoch"].tolist(),
                "count": group["succesful_miners"].tolist()
            },
            "learning_rate": {
                "epoch": group["epoch"].tolist(),
                "value": [None if (isinstance(v, float) and np.isnan(v)) else v for v in group["learning_rate"].tolist()]
            }
        }
        for validator_uid, group in df_clean_vali.groupby("validator_uid")
    }


    return {
        "miners": miners_dict,
        "validators": validators_dict
    }

# ----------------------------------------
# 3. Combined Data Orchestration
# ----------------------------------------
def generate_graph_data(run_id: str = None) -> dict:
    """
    Combine miner/validator graph data with losses data into one dictionary.
    If run_id is None, fetch the latest run_id dynamically.
    """
    if run_id is None:
        run_id = get_latest_run_id_from_validator_metrics(days=7)
        print(f"No run_id provided, using latest run_id from validator metrics: {run_id}")
    else:
        print(f"Using provided run_id: {run_id}")

    losses_data = get_global_model_losses_influx_data(run_id)
    influx_data = get_miner_and_validator_influx_data(run_id, epoch = max(losses_data['outer_steps']) if losses_data['outer_steps'] != [] else 0)
    active_miners_count = get_active_miners() 

    print("ACTIVE MINERS")
    print(active_miners_count)

    output = {
        "run_id": run_id,
        **influx_data,
        "loss_graph": losses_data,
        "active_miners": active_miners_count,
        "model_size": "1.1B"
    }

    json_path = "processed/graphs_data.json"
    if not os.path.exists("processed"):
        os.makedirs("processed")
    with open(json_path, "w") as f:
        json.dump(output, f, indent=2)

    now_utc = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    print(f"✅ combined_graph dict created at {now_utc}")

    return output


# ----------------------------------------
# Entry point
# -----------------------------------------
if __name__ == "__main__":
    generate_graph_data()
