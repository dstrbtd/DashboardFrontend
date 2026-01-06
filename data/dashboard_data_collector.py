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
from dotenv import load_dotenv


warnings.simplefilter("ignore", MissingPivotFunction)

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ENV_PATH = os.path.join(PROJECT_ROOT, ".env")

if os.path.exists(ENV_PATH):
    load_dotenv(ENV_PATH)
else:
    raise FileNotFoundError(f"Warning: .env file not found at expected location: {ENV_PATH}")

def initialize_influx_client() -> InfluxDBClient:
    client = InfluxDBClient(
        url=os.getenv("INFLUXDB_URL"),
        token=os.getenv("INFLUXDB_TOKEN_MECHANISM_0"),
        org=os.getenv("INFLUXDB_ORG"),
        timeout=260_000
    )
    return client

counter = 0

def get_active_miners_bt_metagraph() -> int:
    metagraph = bt.metagraph(netuid=38)
    active_miners = len([
        x for x in range(metagraph.n)
        if metagraph.axons[x].ip != "0.0.0.0" and metagraph.stake[x] <= 1000
    ])
    return active_miners

def get_latest_run_and_epoch_validator_influx(days: int = 30) -> tuple[str, int]:
    """
    Return (latest_run_id, latest_epoch_for_that_run).
    Logic stays clear and debuggable.
    Searches across multiple measurements to find run_ids.
    """
    client = initialize_influx_client()
    query_api = client.query_api()

    # Search across multiple measurements that might contain run_id
    # miner_scores has run_id as a field
    # evaluation_metrics has run_id in the tag field (format: "{run_id}.{epoch}.{step}")
    run_ids = []
    
    # Query miner_scores for run_id field
    flux_run_ids_miner = f'''
    from(bucket: "mechanism-0")
      |> range(start: -{days}d)
      |> filter(fn: (r) => r._measurement == "miner_scores")
      |> filter(fn: (r) => exists r.run_id)
      |> keep(columns: ["run_id"])
      |> group()
      |> distinct(column: "run_id")
    '''
    
    try:
        result_run = query_api.query(org="DSTRBTD", query=flux_run_ids_miner)
        measurement_run_ids = [r.values["_value"] for t in result_run for r in t.records]
        run_ids.extend(measurement_run_ids)
    except Exception as e:
        print(f"Warning: Could not query miner_scores for run_ids: {e}")
    
    # Query evaluation_metrics - extract run_id from tag field (tag format: "{run_id}.{epoch}.{step}")
    flux_run_ids_eval = f'''
    import "strings"
    from(bucket: "mechanism-0")
      |> range(start: -{days}d)
      |> filter(fn: (r) => r._measurement == "evaluation_metrics")
      |> filter(fn: (r) => exists r.tag)
      |> map(fn: (r) => ({{
          r with run_id: strings.split(v: r.tag, t: ".")[0]
        }}))
      |> keep(columns: ["run_id"])
      |> group()
      |> distinct(column: "run_id")
    '''
    
    try:
        result_run = query_api.query(org="DSTRBTD", query=flux_run_ids_eval)
        measurement_run_ids = [r.values["_value"] for t in result_run for r in t.records]
        run_ids.extend(measurement_run_ids)
    except Exception as e:
        print(f"Warning: Could not query evaluation_metrics for run_ids: {e}")
    
    # Remove duplicates and convert to int for proper sorting
    run_ids = list(set(run_ids))
    
    if not run_ids:
        raise ValueError(f"No run_ids found in the past {days} days in miner_scores or evaluation_metrics.")

    latest_run_id = max(run_ids, key=lambda x: int(x))

    # Search for epochs across multiple measurements
    epochs = []
    
    # Query miner_scores for epochs
    flux_epochs_miner = f'''
    from(bucket: "mechanism-0")
      |> range(start: -30d)
      |> filter(fn: (r) => r._measurement == "miner_scores")
      |> filter(fn: (r) => r.run_id == "{latest_run_id}")
      |> filter(fn: (r) => exists r.epoch)
      |> keep(columns: ["epoch"])
      |> group()
      |> distinct(column: "epoch")
    '''
    
    try:
        result_epochs = query_api.query(org="DSTRBTD", query=flux_epochs_miner)
        measurement_epochs = [int(r.values["_value"]) for t in result_epochs for r in t.records]
        epochs.extend(measurement_epochs)
    except Exception as e:
        print(f"Warning: Could not query miner_scores for epochs: {e}")
    
    # Query evaluation_metrics - extract epoch from tag field (tag format: "{run_id}.{epoch}.{step}")
    flux_epochs_eval = f'''
    import "strings"
    from(bucket: "mechanism-0")
      |> range(start: -30d)
      |> filter(fn: (r) => r._measurement == "evaluation_metrics")
      |> filter(fn: (r) => exists r.tag)
      |> map(fn: (r) => ({{
          r with run_id: strings.split(v: r.tag, t: ".")[0],
          epoch: int(v: strings.split(v: r.tag, t: ".")[1])
        }}))
      |> filter(fn: (r) => r.run_id == "{latest_run_id}")
      |> keep(columns: ["epoch"])
      |> group()
      |> distinct(column: "epoch")
    '''
    
    try:
        result_epochs = query_api.query(org="DSTRBTD", query=flux_epochs_eval)
        measurement_epochs = [int(r.values["_value"]) for t in result_epochs for r in t.records]
        epochs.extend(measurement_epochs)
    except Exception as e:
        print(f"Warning: Could not query evaluation_metrics for epochs: {e}")
    
    # Remove duplicates
    epochs = list(set(epochs))

    if not epochs:
        raise ValueError(f"No epochs found for run_id {latest_run_id} in miner_scores or evaluation_metrics")

    latest_epoch = max(epochs)

    return latest_run_id, latest_epoch


def get_global_model_loss_influx(run_id: str) -> dict:
    """
    Retrieve outer_steps vs. losses for fineweb task for given run_id.
    Matches exact run_id.0.0 and run_id.x tags.
    """
    client = initialize_influx_client()
    query_api = client.query_api()

    query = f"""
    import "strings"
    from(bucket: "mechanism-0")
        |> range(start: -365d)
        |> filter(fn: (r) => r._measurement == "evaluation_metrics")
        |> filter(fn: (r) => r.tag == "{run_id}.0.0" or r.tag =~ /^{run_id}\\./)
        |> filter(fn: (r) => r.task == "fineweb")
        |> map(fn: (r) => ({{
                r with outer_step: int(v: strings.split(v: r.tag, t: ".")[1])
            }}))
        |> group(columns: ["outer_step"])
        |> sort(columns: ["_time"], desc: true)  // newest first
        |> unique(column: "outer_step")          // keep only 1 per step
        |> sort(columns: ["outer_step"])         // re-sort by step ascending
    """

    results = query_api.query(org="DSTRBTD", query=query)

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

    result = {
        "outer_steps": outer_steps,
        "losses": losses,
    }
    
    if not outer_steps or not losses:
        print(f"Warning: No global_loss_data found for run_id {run_id}")
        print(f"  outer_steps count: {len(outer_steps)}, losses count: {len(losses)}")
    
    return result

def get_miner_influx_data(run_id: str = "6", epoch: int = 0, days: int = 30) -> dict:
    """
    Get miner training data including loss per epoch.
    Note: This queries training_metrics which may not exist for all runs.
    Returns empty dict if data is not available.
    """
    client = initialize_influx_client()
    query_api = client.query_api()

    try:
        flux = f'''
        from(bucket: "mechanism-0")
            |> range(start: -{days}d)
            |> filter(fn: (r) => r._measurement == "training_metrics")
            |> filter(fn: (r) => r._field == "loss")
            |> filter(fn: (r) => r["run_id"] == "{run_id}")
            |> group(columns: ["miner_uid", "epoch", "run_id"])
            |> mean()
        '''
        df_train = query_api.query_data_frame(flux)
        if isinstance(df_train, list):
            df_train = pd.concat(df_train, ignore_index=True)
    except Exception as e:
        print(f"Warning: Could not query miner data from training_metrics: {e}")
        return {}
    
    if df_train.empty:
        print(f"Warning: No miner training data found for run_id {run_id} (training_metrics measurement may not exist)")
        return {}

    df_train = df_train.rename(columns={"_value": "loss"})
    df_train = df_train[["miner_uid", "run_id", "epoch", "loss"]].dropna().reset_index(drop=True)
    df_train = df_train[df_train["loss"] > 0.0]
    df_train["epoch"] = df_train["epoch"].astype(int)
    df_train = df_train.sort_values(by=["epoch", "miner_uid"]).reset_index(drop=True)

    miners_dict = {
        str(miner_uid): {
            "epoch": group["epoch"].tolist(),
            "loss": group["loss"].tolist()
        }
        for miner_uid, group in df_train.groupby("miner_uid")
    }
    return miners_dict

def get_validator_influx_data(run_id: str = "6", epoch: int = 0, days: int = 30) -> dict:
    """
    Get validator data including learning rate and number of peers.
    Note: This queries allreduce_operations which may not exist for all runs.
    Returns empty dict if data is not available.
    """
    client = initialize_influx_client()
    query_api = client.query_api()

    try:
        flux = f'''
        from(bucket: "mechanism-0")
            |> range(start: -{days}d)
            |> filter(fn: (r) => r._measurement == "allreduce_operations")
            |> filter(fn: (r) => exists r.epoch and exists r.validator_uid and exists r._value)
            |> filter(fn: (r) => r["run_id"] == "{run_id}")
            |> filter(fn: (r) => int(v: r.epoch) <= {epoch})
            |> drop(columns: ["_start", "_stop"])
            |> group(columns: ["validator_uid", "epoch", "run_id", "_field"])
            |> max()
            |> pivot(rowKey: ["epoch", "validator_uid"], columnKey: ["_field"], valueColumn: "_value")
            |> sort(columns: ["epoch"])
        '''
        df_allreduce = query_api.query_data_frame(flux)
        if isinstance(df_allreduce, list):
            df_allreduce = pd.concat(df_allreduce, ignore_index=True)
    except Exception as e:
        print(f"Warning: Could not query validator data from allreduce_operations: {e}")
        return {}
    
    # Handle empty DataFrame or missing columns
    if df_allreduce.empty or "participating_miners" not in df_allreduce.columns:
        print(f"Warning: No validator data found for run_id {run_id} (allreduce_operations measurement may not exist)")
        return {}

    df_allreduce["participating_miners"] = df_allreduce["participating_miners"].round().astype(int)
    df_allreduce["succesful_miners"] = df_allreduce["participating_miners"] - df_allreduce["failed_miners"].fillna(0).astype(int)
    df_allreduce["epoch"] = df_allreduce["epoch"].astype(int)
    df_allreduce["run_id"] = run_id

    validators_dict = {
        str(validator_uid): {
            "peers": {
                "epoch": group.sort_values("epoch")["epoch"].tolist(),
                "count": group.sort_values("epoch")["succesful_miners"].tolist()
            },
            "learning_rate": {
                "epoch": group.sort_values("epoch")["epoch"].tolist(),
                "value": [
                    None if (isinstance(v, float) and np.isnan(v)) else v
                    for v in group.sort_values("epoch")["learning_rate"].tolist()
                ]
            }
        }
        for validator_uid, group in df_allreduce.groupby("validator_uid")
    }

    return validators_dict

def preview_dict(d: dict, max_items: int = 3) -> dict:
    """
    Return a shortened preview of a nested dict:
    - Show at most `max_items` keys
    - If a value is a list, show only the first element
    """
    preview = {}
    for i, (k, v) in enumerate(d.items()):
        if i >= max_items:
            break
        if isinstance(v, dict):
            preview[k] = preview_dict(v, max_items=max_items)
        elif isinstance(v, list):
            preview[k] = v[-1] if v else None
        else:
            preview[k] = v
    return preview

def generate_dashboard_data(save_json: bool = True) -> dict:
    """
    Combine miner/validator graph data with losses data into one dictionary.
    If run_id is None, fetch the latest run_id dynamically.
    Verbose controls printing. save_json controls saving to dashboard_data.json.
    """

    run_id, latest_epoch = get_latest_run_and_epoch_validator_influx()
    run_id = 5
    # latest_epoch = 50

    print(f"run_id: {run_id}")
    print(f"latest_epoch: {latest_epoch}")

    global_loss_data = get_global_model_loss_influx(run_id)

    if global_loss_data.get("outer_steps") and latest_epoch is not None:
        steps = global_loss_data["outer_steps"]
        losses = global_loss_data["losses"]

        if steps:
            max_existing = max(steps)
            if max_existing < latest_epoch:
                pad_steps = list(range(max_existing + 2, latest_epoch + 2))
                steps.extend(pad_steps)
                losses.extend([None] * len(pad_steps))

    print(f"global_loss_data preview: {preview_dict(global_loss_data)}")

    active_miners_count = get_active_miners_bt_metagraph()
    print(f"Active miners count: {active_miners_count}")

    validator_data = get_validator_influx_data(run_id, epoch=latest_epoch)
    print(f"validator_data preview: {preview_dict(validator_data)}")

    miner_data = get_miner_influx_data(run_id, epoch=latest_epoch)
    print(f"miner_data preview: {preview_dict(miner_data)}")

    dashboard_dict = {
        "run_id": run_id,
        "miners": miner_data,
        "validators": validator_data,
        "global_loss_data": global_loss_data,
        "active_miners": active_miners_count,
        "model_size": "1.1B"
    }

    if save_json:
        filename = "dashboard_data.json"
        with open(filename, "w") as f:
            json.dump(dashboard_dict, f, indent=2)
        print(f"✅ {filename} saved and dashboard_dict created")
    else:
        print(f"✅ dashboard_dict created")

    return dashboard_dict

if __name__ == "__main__":
    dashboard_dict = generate_dashboard_data()


