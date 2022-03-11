import asyncio
import pathlib
import ssl
import websockets

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
            print(f"ConnectionClose by Peer index {peer_index}")
            # Note: .close() ?
            peers[peer_index] = None
            number_of_peers -= 1
            break
        print(f"Peer index {peer_index} <<< {message} <<< {user}")

        for peer in peers:
            if peer:
                await peer.send(f"{user}::{message}")

async def register(websocket):
    global MAX_PEERS, number_of_peers, peers
    if number_of_peers >= MAX_PEERS:
        return False
    # Alert other peers
    for peer in peers:
        if peer:
            await peer.send(f"0::Someone just entered the chat!")
    peers.append(websocket)
    number_of_peers += 1
    return len(peers)

# ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
# localhost_pem = pathlib.Path(__file__).with_name("localhost.pem")
# ssl_context.load_cert_chain(localhost_pem)

async def main():
    async with websockets.serve(chat, "0.0.0.0", 8765): #, ssl=ssl_context):
        await asyncio.Future() # Run forever

if __name__ == "__main__":
    asyncio.run(main())