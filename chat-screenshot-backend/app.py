#!./chat-screenshot-backend/.venv/bin/python3.9

import asyncio
import websockets
import json

async def register(websocket):
    message = await websocket.recv()
    print(">>>", message)

    answer = json.dumps({"action":"register","unreadData":[]})
    print("<<<", answer)
    await websocket.send(answer)
    await asyncio.Future()

async def main():
    print(f"Run websocket at ws://localhost:8765")
    async with websockets.serve(register, "localhost", 8765):
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    asyncio.run(main())
