import asyncio
import json
import websockets
from pathlib import Path
from queryInfluxData import generate_graph_data  # Import your function
from websockets.exceptions import ConnectionClosedOK
from datetime import datetime, timezone

last_data = None
last_epoch = -1

connected = set()


async def notify_clients():
    global last_data, last_epoch

    while True:
        try:
            data = await asyncio.to_thread(generate_graph_data)

            all_epochs = []
            for miner_data in data.get("miners", {}).values():
                all_epochs += miner_data.get("epoch", [])

            if all_epochs:
                new_max_epoch = max(all_epochs)
            else:
                new_max_epoch = last_epoch

            if new_max_epoch > last_epoch:
                print(f"📈 New epoch {new_max_epoch} detected (previous was {last_epoch})")
                last_data = json.dumps(data)
                last_epoch = new_max_epoch
            else:
                print(f"⏳ No new epoch (latest: {last_epoch}) — serving cached data")

            for ws in connected.copy():
                try:
                    await ws.send(last_data)
                except Exception:
                    connected.discard(ws)

        except Exception as e:
            print("Error in notify_clients:", e)

        await asyncio.sleep(30)


async def handler(websocket):
    try:
        print(f"Client connected: {websocket.remote_address}")
        connected.add(websocket)

        if last_data:
            await websocket.send(last_data)

        await websocket.wait_closed()

    except ConnectionClosedOK:
        pass
    except Exception as e:
        print(f"WebSocket client error: {e}")
    finally:
        connected.discard(websocket)
        print(f"Client disconnected: {websocket.remote_address}")


async def main():
    global last_data, last_epoch

    print("🔄 Preloading initial graph data (this may take some time)...")
    data = await asyncio.to_thread(generate_graph_data)
    last_data = json.dumps(data)

    all_epochs = []
    for miner_data in data.get("miners", {}).values():
        all_epochs += miner_data.get("epoch", [])
    last_epoch = max(all_epochs) if all_epochs else -1

    server_ip = "0.0.0.0"
    port = 8765
    print(f"Starting WebSocket server on ws://{server_ip}:{port}")

    async with websockets.serve(
        handler,
        server_ip,
        port,
        ping_interval=20,
        ping_timeout=20,
    ):
        await notify_clients()


if __name__ == "__main__":
    asyncio.run(main())
