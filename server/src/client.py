import asyncio
import websockets
 
async def hello():
    uri = "ws://172.20.10.2:8765"
    async with websockets.connect(uri) as websocket:
        name = input("What's your name? ")

        await websocket.send(name)
        print(f">>> {name}")

        greeting = await websocket.recv()
        print(f"<<< {greeting}")

        await websocket.send("And Again!")
        print(f">>> And Again!")
        greeting = await websocket.recv()
        print(f"<<< {greeting}")

if __name__ == "__main__":
    asyncio.run(hello())