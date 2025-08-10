import asyncio
import json
import websockets
from pathlib import Path
from queryInfluxData import generate_graph_data
from concurrent.futures import ThreadPoolExecutor

# Cached data
last_data = None
last_epoch = -1
connected = set()

# Optional JSON path if you want to persist to disk
JSON_PATH = Path("/media/jorrit/ssd/bittensor/38_training/webpage/miner-dashboard/public/miner_graph_data.json")

# Thread pool for running slow Influx queries without blocking event loop
executor = ThreadPoolExecutor(max_workers=1)


# ------------------------
# Load data from Influx
# ------------------------
def blocking_generate_graph_data():
    """Wrapper so we can run the slow function in a thread."""
    return generate_graph_data()


async def load_data():
    """Run generate_graph_data in a background thread and update cache if needed."""
    global last_data, last_epoch

    try:
        # Run slow Influx function in separate thread
        data = await asyncio.get_event_loop().run_in_executor(executor, blocking_generate_graph_data)

        # Determine latest epoch in the miners data
        all_epochs = []
        for miner_data in data.get("miners", {}).values():
            all_epochs += miner_data.get("epoch", [])

        if all_epochs:
            new_max_epoch = max(all_epochs)
        else:
            new_max_epoch = last_epoch

        if new_max_epoch > last_epoch or last_data is None:
            print(f"📈 New epoch {new_max_epoch} detected (previous {last_epoch}) — updating cache")
            last_data = json.dumps(data)
            last_epoch = new_max_epoch

            # Optionally persist to disk
            try:
                JSON_PATH.write_text(last_data)
            except Exception as e:
                print(f"⚠️ Could not write cache file: {e}")
        else:
            print(f"⏳ No new epoch (latest: {last_epoch}) — keeping cached data")

    except Exception as e:
        print(f"❌ Error loading data from Influx: {e}")


# ------------------------
# Notify loop
# ------------------------
async def notify_clients():
    """Background loop to periodically refresh data and push to clients."""
    while True:
        await load_data()

        # Send latest cached data to all connected clients
        if last_data:
            for ws in connected.copy():
                try:
                    await ws.send(last_data)
                except Exception:
                    connected.remove(ws)

        await asyncio.sleep(30)  # check every 30 seconds


# ------------------------
# WebSocket handler
# ------------------------
async def handler(websocket):
    print(f"Client connected: {websocket.remote_address}")
    connected.add(websocket)
    try:
        # Serve cached data instantly
        if last_data:
            await websocket.send(last_data)
        else:
            # Optional: send a "loading" message instead of waiting silently
            await websocket.send(json.dumps({"status": "loading"}))

        await websocket.wait_closed()
    finally:
        print(f"Client disconnected: {websocket.remote_address}")
        connected.remove(websocket)


# ------------------------
# Main entry point
# ------------------------
async def main():
    print("🔄 Preloading initial data...")
    await load_data()  # Load once at startup

    server_ip = "0.0.0.0"
    async with websockets.serve(handler, server_ip, 8765):
        print(f"✅ WebSocket server started on ws://{server_ip}:8765")
        await notify_clients()


if __name__ == "__main__":
    asyncio.run(main())
