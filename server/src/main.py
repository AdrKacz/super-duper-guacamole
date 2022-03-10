import asyncio
import pathlib
import ssl
import websockets

from uuid import uuid4

async def hello(websocket):
    while True:
        try:
            name = await websocket.recv()
        except websockets.ConnectionClosed:
            print(f"Terminated")
            break
        print(f"<<< {name}")
        greeting = f"Hello {name}!"
        await websocket.send(greeting)
        print(f">>> {greeting}")

# ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
# localhost_pem = pathlib.Path(__file__).with_name("localhost.pem")
# ssl_context.load_cert_chain(localhost_pem)

async def main():
    async with websockets.serve(hello, "172.20.10.2", 8765): #, ssl=ssl_context):
        await asyncio.Future() # Run forever

if __name__ == "__main__":
    asyncio.run(main())