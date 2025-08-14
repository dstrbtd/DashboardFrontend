import pandas as pd
import matplotlib.pyplot as plt
import numpy as np

df_miner = pd.read_csv("miner_data.csv")
df_val = pd.read_csv("vali_data.csv")

df_merged = pd.merge(df_miner, df_val, on="epoch", how="inner")

unique_miners = df_merged["miner_uid"].unique()
random_miners = np.random.choice(unique_miners, size=10, replace=False)

df_filtered = df_merged[df_merged["miner_uid"].isin(random_miners)]

fig, ax1 = plt.subplots(figsize=(12, 6))

for miner_uid, group in df_filtered.groupby("miner_uid"):
    ax1.plot(
        group["epoch"],
        group["loss"],
        label=f"Miner {miner_uid}",
        alpha=0.7,
        linewidth=1.5
    )

ax1.set_xlabel("Epoch")
ax1.set_ylabel("Loss (per Miner)", color="black")
ax1.tick_params(axis='y', labelcolor="black")

ax1.legend(
    loc="center left",
    bbox_to_anchor=(1.05, 0.5),
    title="Miner UID",
    fontsize="small",
    frameon=False
)

ax2 = ax1.twinx()
ax2.plot(
    df_val["epoch"],
    df_val["participating_miners"],
    color="black",
    marker="x",
    linestyle="-",
    linewidth=2,
    label="Number of Peers"
)
ax2.set_ylabel("Number of Peers", color="black")
ax2.tick_params(axis='y', labelcolor="black")

ax2.legend(loc="upper right", fontsize="small", frameon=False)

plt.title("Miner Loss (Random 10 Miners) vs Number of Peers per Epoch")
plt.grid(True)
plt.tight_layout()

plt.savefig("miner_graph_v1_random10.png")
plt.show()
