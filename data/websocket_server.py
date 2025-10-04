import asyncio
import json
import websockets
from pathlib import Path
from dashboard_data_collector import generate_dashboard_data 
from websockets.exceptions import ConnectionClosedOK
from datetime import datetime, timezone

last_data = None
last_epoch = -1

connected = set()


async def notify_clients():
    global last_data, last_epoch
    loop_counter = 0  # Initialize loop counter

    while True:
        loop_counter += 1
        now_utc = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{now_utc}] Loop {loop_counter}: generate_dashboard_data")

        try:
            data = await asyncio.to_thread(
                generate_dashboard_data,
                verbose=True,
                save_json=True
            )

            all_epochs = []
            for miner_data in data.get("miners", {}).values():
                all_epochs += miner_data.get("epoch", [])

            if all_epochs:
                new_max_epoch = max(all_epochs)
            else:
                new_max_epoch = last_epoch

            if new_max_epoch > last_epoch:
                print(f"📈 New epoch {new_max_epoch} detected \n")
                last_data = json.dumps(data)
                last_epoch = new_max_epoch
            else:
                print(f"⏳ No new epoch (latest: {last_epoch}) — serving cached data \n")

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
    server_ip = "0.0.0.0"
    port = 8765
    print(f"Starting WebSocket server on ws://{server_ip}:{port}")
    print(f"To make this websockets server available on HTTPS, as Vercel requires, apply ngrok tunneling (README.md)\n")

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
