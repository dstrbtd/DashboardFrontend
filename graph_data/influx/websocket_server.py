import asyncio
import json
import websockets
from pathlib import Path
from queryInfluxData import generate_graph_data  # Import the function

last_data = None
last_epoch = -1

connected = set()

async def notify_clients():
    global last_data, last_epoch

    while True:
        try:
            # Generate data to check if a new epoch is available
            data = generate_graph_data()

            # Extract latest epoch from the result
            all_epochs = []
            for miner_data in data.get("miners", {}).values():
                all_epochs += miner_data.get("epoch", [])

            if all_epochs:
                new_max_epoch = max(all_epochs)
            else:
                new_max_epoch = last_epoch  # no epoch data, keep old

            if new_max_epoch > last_epoch:
                # New data detected!
                print(f"📈 New epoch {new_max_epoch} detected (previous was {last_epoch})")
                last_data = json.dumps(data)
                last_epoch = new_max_epoch
            else:
                print(f"⏳ No new epoch (latest: {last_epoch}) — serving cached data")

            # Send the latest (cached or fresh) data
            for ws in connected.copy():
                try:
                    await ws.send(last_data)
                except Exception:
                    connected.remove(ws)

        except Exception as e:
            print("Error in notify_clients:", e)

        await asyncio.sleep(30)


async def handler(websocket):
    print(f"Client connected: {websocket.remote_address}")
    connected.add(websocket)
    try:
        # Send cached data on connection (if any)
        if last_data:
            await websocket.send(last_data)

        await websocket.wait_closed()
    finally:
        print(f"Client disconnected: {websocket.remote_address}")
        connected.remove(websocket)


async def main():
    # "0.0.0.0" # means accessible from any IP
    # "127.0.0.1" # loopback so only accessible from the same machine
    server_ip = "0.0.0.0"
    async with websockets.serve(handler, server_ip, 8765): 
        print(f"WebSocket server started on ws://{server_ip}:8765")
        await notify_clients()

if __name__ == "__main__":
    asyncio.run(main())