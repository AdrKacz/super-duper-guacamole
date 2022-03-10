import asyncio
import websockets
 
async def hello():
    uri = "ws://127.0.0.1:8080"
    async with websockets.connect(uri) as websocket:
        message = input("Type a message? ")
        while (len(message) > 0):
            await websocket.send(f"usertest::{message}")
            print(f">>> usertest::{message}")

            returns = await websocket.recv()
            print(f"<<< {returns}")
            message = input("Type a message? ")


if __name__ == "__main__":
    asyncio.run(hello())