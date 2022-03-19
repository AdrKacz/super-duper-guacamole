import asyncio
import pathlib
import ssl
import websockets

# TODO: Set MAX_PEERS as environment variable
MAX_PEERS = 4
number_of_peers = 0
peers = []

async def chat(websocket):
    global number_of_peers, peers
    peer_index = await register(websocket) # 1-based
    if not peer_index:
        # Should close the connection - not clean
        return
    peer_index = peer_index - 1 # 0-based
    while True:
        try:
            data = await websocket.recv()
            print(data)
            try:
                user, message = data.split("::", 1)
            except ValueError as err:
                print(f"[Error] > {err} with data {data}")
                continue
        except websockets.ConnectionClosed:
            print(f"Connection closed by Peer index {peer_index}")
            # Note: .close() ?
            peers[peer_index] = None
            number_of_peers -= 1
            break
        print(f"Peer index {peer_index} <<< {message} <<< {user}")

        # Broadcast message to peers
        for peer in peers:
            if peer:
                await peer.send(f"{user}::{message}")
        # Send notification

async def register(websocket):
    global MAX_PEERS, number_of_peers, peers
    if number_of_peers >= MAX_PEERS:
        return False
    # Alert other peers
    print(f"Peer {len(peers)} just entered the chat")
    for peer in peers:
        if peer:
            await peer.send(f"0::Someone just entered the chat!")
    peers.append(websocket)
    number_of_peers += 1
    return len(peers)

# ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
# localhost_pem = pathlib.Path(__file__).with_name("localhost.pem")
# ssl_context.load_cert_chain(localhost_pem)

async def server():
    print("Start server on port 8765")
    # TODO: add try, except asyncio.CancelledError:, finally to close the server properly
    async with websockets.serve(chat, "0.0.0.0", 8765): #, ssl=ssl_context):
        await asyncio.Future() # Run forever

async def alive():
    await asyncio.sleep(10)
    while number_of_peers > 0:
        # TODO: Add date-time on print
        print(f"Server is alive with {number_of_peers} peers connected.")
        await asyncio.sleep(10)

async def main():
    # Start server
    server_task = asyncio.create_task(server())
    alive_task = asyncio.create_task(alive())

    def cancel_server_task(_):
        print(f"Close the server: no user left")
        server_task.cancel()

    alive_task.add_done_callback(cancel_server_task)

    await server_task
    await alive_task

if __name__ == "__main__":
    asyncio.run(main())