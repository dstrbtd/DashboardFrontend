from influxdb_client import InfluxDBClient
import pandas as pd
import numpy as np
import json
import warnings
from influxdb_client.client.warnings import MissingPivotFunction
from datetime import datetime, timezone
import time

warnings.simplefilter("ignore", MissingPivotFunction)

counter = 0

# ----------------------------------------
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
    from(bucket: "distributed-training-metrics")
      |> range(start: -365d)
      |> filter(fn: (r) => r._measurement == "evaluation_metrics")
      |> filter(fn: (r) => r.tag == "{run_id}.0.0" or r.tag =~ /^{run_id}\./)
      |> filter(fn: (r) => r.task == "fineweb")
      |> sort(columns: ["_time"])
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


def get_miner_and_validator_influx_data(run_id: str = "6", days: int = 1) -> dict:
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

    def get_miner_training_metrics(run_id: str, days: int):
        flux = f'''
        from(bucket: "distributed-training-metrics")
          |> range(start: -{days}d)
          |> filter(fn: (r) => r._measurement == "training_metrics")
          |> filter(fn: (r) => r._field == "loss")
          |> filter(fn: (r) => r["run_id"] == "{run_id}")
          |> group(columns: ["miner_uid", "epoch", "run_id"])
          |> mean()
        '''
        df = query_api.query_data_frame(flux)
        return df if isinstance(df, pd.DataFrame) else pd.DataFrame()

    def get_validator_allreduce_operations_metrics(run_id: str, days: int):
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
        df = query_api.query_data_frame(flux)
        return df if isinstance(df, pd.DataFrame) else pd.DataFrame()

    # start_time = time.time()
    # df_train = get_miner_training_metrics(run_id, days).rename(columns={"_value": "loss"})
    # print("df_train columns:", df_train.columns.tolist())
    # print(df_train.head())    
    # end_time = time.time()
    # print(f"Time miner training metrics: {end_time - start_time:.2f} seconds")

    # columns_needed = ["miner_uid", "run_id", "epoch", "loss"]
    # df_clean_miner = (
    #     df_train[columns_needed]
    #     .dropna(subset=columns_needed)
    #     .reset_index(drop=True)
    # )
    # df_clean_miner = df_clean_miner[df_clean_miner["loss"] > 0.0]
    # df_clean_miner["epoch"] = df_clean_miner["epoch"].astype(int)
    # df_clean_miner = df_clean_miner.sort_values(by=["epoch", "miner_uid"]).reset_index(drop=True)

    start_time = time.time()
    df_allreduce = get_validator_allreduce_operations_metrics(run_id, days)
    print("Allreduce columns:", df_allreduce.columns.tolist())
    print(df_allreduce.head())
    end_time = time.time()
    print(f"Time validator allreduce metrics: {end_time - start_time:.2f} seconds")

    exit(1)

    columns_needed_vali = ["validator_uid", "epoch", "participating_miners"]
    df_clean_vali = (
        df_allreduce[columns_needed_vali]
        .dropna(subset=columns_needed_vali)
        .reset_index(drop=True)
    )
    df_clean_vali["participating_miners"] = df_clean_vali["participating_miners"].round().astype(int)
    df_clean_vali["epoch"] = df_clean_vali["epoch"].astype(int)
    df_clean_vali["run_id"] = run_id
    df_clean_vali = df_clean_vali[["validator_uid", "run_id", "epoch", "participating_miners"]]
    df_clean_vali = df_clean_vali.sort_values("epoch").reset_index(drop=True)

    # df_merged = pd.merge(df_clean_miner, df_clean_vali, on="epoch", how="inner")
    df_merged = pd.merge(df_clean_miner, df_clean_vali, on="epoch", how="outer")
    df_merged = df_merged.sort_values(by="epoch").reset_index(drop=True)


    unique_miners = df_merged["miner_uid"].unique()
    num_miners_to_sample = min(10, len(unique_miners))
    random_miners = np.random.choice(unique_miners, size=num_miners_to_sample, replace=False)

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
                "count": group["participating_miners"].tolist()
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
def generate_graph_data(run_id: str = "6") -> dict:
    """
    Combine miner/validator graph data with losses data into one dictionary.
    """
    influx_data = get_miner_and_validator_influx_data(run_id)
    losses_data = get_global_model_losses_influx_data(run_id)

    output = {
        "run_id": run_id,
        **influx_data,
        "loss_graph": losses_data
    }

    # # Save JSON
    # json_path = "/media/jorrit/ssd/bittensor/38_training/webpage_dt/graph_data/influx/graphs_data.json"
    # with open(json_path, "w") as f:
    #     json.dump(output, f, indent=2)

    now_utc = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    print(f"✅ combined_graph dict created at {now_utc}")

    return output


# ----------------------------------------
# Entry point
# ----------------------------------------
if __name__ == "__main__":
    generate_graph_data()
