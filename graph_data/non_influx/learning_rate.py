from huggingface_hub import HfApi
import torch
import re

def main():
    repo_id = "distributed/llama-1b"
    api = HfApi()

    commits = api.list_repo_commits(repo_id=repo_id)
    print(f"Found {len(commits)} commits.\n")

    lr_dict = {}

    # Regex patterns to extract run and outer step from commit title
    run_pattern = re.compile(r"Run\s+(\d+)", re.IGNORECASE)
    outer_step_pattern = re.compile(r"Outer Step\s+(\d+)", re.IGNORECASE)

    for commit in commits:
        sha = commit.commit_id
        title = commit.title.strip() if commit.title else "<no title>"

        # Extract run and outer step numbers from title
        run_match = run_pattern.search(title)
        outer_step_match = outer_step_pattern.search(title)
        run_key = f"Run {run_match.group(1)}" if run_match else "Run Unknown"
        outer_step_key = f"Outer Step {outer_step_match.group(1)}" if outer_step_match else "Outer Step Unknown"

        try:
            files = api.list_repo_files(repo_id=repo_id, revision=sha)
            has_pt = "✅" if "inner_optimizer.pt" in files else "❌"
        except Exception as e:
            has_pt = f"Error: {e}"

        print(f"{sha} | {title} | inner_optimizer.pt: {has_pt}")

        if has_pt == "✅":
            local_path = api.hf_hub_download(repo_id=repo_id, filename="inner_optimizer.pt", revision=sha)
            checkpoint = torch.load(local_path, map_location="cpu")
            lr = checkpoint.get("learning_rate", None)
            print(f"Learning rate at commit {sha}: {lr}")

            # Build nested dictionary
            lr_dict.setdefault(run_key, {})
            lr_dict[run_key][outer_step_key] = lr

    print("\nSummary of learning rates by run and outer step:")
    for run, steps in lr_dict.items():
        print(f"{run}:")
        for outer_step, lr in sorted(steps.items()):
            print(f"  {outer_step}: {lr}")

if __name__ == "__main__":
    main()
