import time
import random
import datetime
from typing import Callable, Dict

import os
from dotenv import load_dotenv, find_dotenv
import torch
import shutil
from datasets import load_dataset
from distributed_training import __run__
from transformers import AutoTokenizer, AutoModelForCausalLM
from huggingface_hub import HfApi, snapshot_download
from huggingface_hub.constants import HF_HUB_CACHE
from pathlib import Path
from influxdb_client import InfluxDBClient, Point, WritePrecision
# from lm_eval import evaluator as lm_evaluator
# from lm_eval.models.huggingface import HFLM

load_dotenv(find_dotenv())

# === CONFIG ===
INFLUXDB_URL = os.getenv("INFLUXDB_URL")
INFLUXDB_TOKEN = os.getenv("INFLUXDB_TOKEN_MECHANISM_0")
INFLUXDB_ORG = os.getenv("INFLUXDB_ORG")
INFLUXDB_BUCKET = os.getenv("INFLUXDB_BUCKET_MECHANISM_0")
INFLUXDB_MEASUREMENT = "evaluation_metrics"
REPO_ID = "distributed/llama-1b"
DATASET_ID = "HuggingFaceFW/fineweb-edu"
DATASET_SKIP_PROBABILITY = 0.9
EVAL_DURATION_MINUTES = 30
EVAL_TYPES = ["fineweb"]  # Add lm-eval harness tasks in the future

# === INFLUXDB SETUP ===
influx = InfluxDBClient(url=INFLUXDB_URL, token=INFLUXDB_TOKEN, org=INFLUXDB_ORG)
write_api = influx.write_api()
query_api = influx.query_api()

def tag_exists(tag: str, task: str) -> bool:
    query = f'''
    from(bucket: "{INFLUXDB_BUCKET}")
    |> range(start: -365d)
    |> filter(fn: (r) => r._measurement == "{INFLUXDB_MEASUREMENT}" and r.tag == "{tag}" and r.task == "{task}")
    |> limit(n:1)
    '''
    result = query_api.query(org=INFLUXDB_ORG, query=query)
    return len(result) > 0

# query = f'''from(bucket: "{INFLUXDB_BUCKET}") |> range(start: -365d) |> filter(fn: (r) => r._measurement == "{INFLUXDB_MEASUREMENT}" and r.tag == "{tag}" and r.task == "{task}") |> limit(n:1)'''
# query = f'''from(bucket: "{INFLUXDB_BUCKET}") |> range(start: -365d) |> filter(fn: (r) => r._measurement == "{INFLUXDB_MEASUREMENT}" and r.tag == "{tag}" and r.task == "{task}") |> limit(n: 1)'''

def log_score(tag: str, task: str, score: float):
    point = (
        Point(INFLUXDB_MEASUREMENT)
        .tag("tag", tag)
        .tag("task", task)
        .field("score", score)
        .time(datetime.datetime.now(datetime.timezone.utc), WritePrecision.NS)
    )
    write_api.write(bucket=INFLUXDB_BUCKET, org=INFLUXDB_ORG, record=point)

# === EVALUATORS ===

def evaluate_fineweb(
    model: torch.nn.Module,
    tokenizer,
    device: torch.device,
    max_minutes: int = EVAL_DURATION_MINUTES,
    sample_size: int = 10000
) -> float:
    """
    Evaluate model on fineweb-edu by computing average LM loss for 30 minutes.
    """
    dataset = load_dataset(DATASET_ID, split="train", streaming=False)
    dataset = dataset.shuffle(seed=42).select(range(sample_size))

    model.eval()
    total_loss = 0.0
    n_batches = 0
    start_time = time.time()

    with torch.no_grad():
        while (time.time() - start_time) < max_minutes * 60:
            sample = dataset[random.randint(0, len(dataset) - 1)]
            if not sample.get("text"):
                continue
            inputs = tokenizer(
                sample["text"],
                return_tensors="pt",
                truncation=True,
                padding="max_length",
                max_length=512
            )
            inputs = {k: v.to(device) for k, v in inputs.items()}
            with torch.autocast(device_type=device.type, dtype=torch.bfloat16):
                outputs = model(**inputs, labels=inputs["input_ids"])
                total_loss += outputs.loss.item()
                n_batches += 1

    return total_loss / n_batches if n_batches > 0 else float("inf")

def evaluate_fineweb(
    model: torch.nn.Module,
    tokenizer,
    device: torch.device,
    max_minutes: int = EVAL_DURATION_MINUTES,
    max_seq_length: int = 512
) -> float:
    """
    Stream and evaluate a fixed-time sample of fineweb-edu on average LM loss.

    Args:
        model: HuggingFace model
        tokenizer: Matching tokenizer
        device: cuda or cpu
        max_minutes: Time budget in minutes
        max_seq_length: Max input length for tokenization

    Returns:
        Average loss
    """ 
    model.eval()
    total_loss = 0.0
    n_batches = 0
    start_time = time.time()

    # Use streaming mode
    dataset = load_dataset(DATASET_ID, split="train", streaming=True)

    with torch.no_grad():
        for sample in dataset:
            if (not sample.get("text")) or (random.random() > (1 - DATASET_SKIP_PROBABILITY)):
                continue
            inputs = tokenizer(
                sample["text"],
                return_tensors="pt",
                truncation=True,
                padding="max_length",
                max_length=max_seq_length
            )
            inputs = {k: v.to(device) for k, v in inputs.items()}
            with torch.autocast(device_type=device.type, dtype=torch.bfloat16):
                outputs = model(**inputs, labels=inputs["input_ids"])
                total_loss += outputs.loss.item()
                n_batches += 1

            if (time.time() - start_time) >= max_minutes * 60:
                break

    return total_loss / n_batches if n_batches > 0 else float("inf")

def evaluate_with_lm_harness(
    model: torch.nn.Module,
    tokenizer,
    device: torch.device,
    task: str
) -> float:
    """
    Evaluate model using lm-eval-harness (e.g. HellaSwag, ARC).
    """
    return

# === EVALUATION REGISTRY ===

def get_evaluator(task: str) -> Callable:
    if task == "fineweb":
        return evaluate_fineweb
    elif task in ["hellaswag", "arc_easy", "arc_challenge"]:
        return lambda model, tokenizer, device: evaluate_with_lm_harness(
            model=model, tokenizer=tokenizer, device=device, task=task
        )
    else:
        raise ValueError(f"Unsupported evaluation task: {task}")

# === MAIN LOOP ===

def evaluate_all_tags_once():
    api = HfApi()
    refs = api.list_repo_refs(REPO_ID)
    tags = sorted(refs.tags, key=lambda p: (int(p.name.split('.')[0]),int(p.name.split('.')[1])))
    sorted(refs.tags, key=lambda p: (int(p.name.split('.')[0]),int(p.name.split('.')[1])))
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    tokenizer, model = None, None
    for tag_obj in tags:
        tag = tag_obj.name
        try:
            if tag.split(".")[0] != __run__:
                continue
            else:
                print(f"\n=== [TAG] {tag} ===")

            for task in EVAL_TYPES:
                if tag_exists(tag, task):
                    print(f"[✓] {task}: already evaluated")
                    continue
                elif (tokenizer is None) or (model is None):
                    print(f"[⏳] Downloading model for tag {tag}...")
                    model_path = snapshot_download(repo_id=REPO_ID, revision=tag)
                    tokenizer = AutoTokenizer.from_pretrained(model_path)
                    tokenizer.pad_token = tokenizer.eos_token
                    model = AutoModelForCausalLM.from_pretrained(model_path, torch_dtype=torch.bfloat16).to(device)
                    
                print(f"[⏳] Evaluating {task}...")
                evaluator = get_evaluator(task)
                score = evaluator(model, tokenizer, device)
                log_score(tag, task, score)
                print(f"[✅] {task}: {score:.4f}")

        except Exception as e:
            print(f"[⚠️] Error evaluating tag {tag}: {e}")
        
        finally:
            cache_dir = HF_HUB_CACHE
            cache_dir = Path(cache_dir).expanduser().resolve()
            for cache in cache_dir.iterdir():
                if os.path.isdir(cache):
                    shutil.rmtree(str(cache))
            tokenizer, model = None, None

# === Optional Continuous Mode ===

def monitor_repo(poll_interval_sec: int = 3600):
    print("[🔁] Starting continuous monitoring...")
    while True:
        evaluate_all_tags_once()
        print(f"[⏳] Sleeping for {poll_interval_sec}s...")
        time.sleep(poll_interval_sec)

# === Entry ===

if __name__ == "__main__":
    evaluate_all_tags_once()
    # monitor_repo()  # Uncomment to run forever
