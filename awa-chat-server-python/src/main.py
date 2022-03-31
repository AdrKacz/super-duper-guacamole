"""
Awa chat python server
"""
import asyncio

# import pathlib
# import ssl
import os
import json
import websockets
import boto3

client_lambda = boto3.client("lambda")

LAMBDA_NOTIFICATION_ARN = os.getenv("LAMBDA_NOTIFICATION_ARN")
ROOM_ID = os.getenv("ROOM_ID")
MAX_PEERS = int(os.getenv("MAX_PEERS"))
NUMBER_OF_PEERS = 0
PEERS = []

print("ENVIRONMENT\n===== ===== =====")
print("LAMBDA_NOTIFICATION_ARN:", LAMBDA_NOTIFICATION_ARN)
print("ROOM_ID:", ROOM_ID)
print("MAX_PEERS:", MAX_PEERS)
print("===== ===== =====")

ALIVE_INITIAL_DELAY = 60  # 1 minutes before first check
ALIVE_DELAY = (
    3600  # Check every hour > close conversation at most two hours after last activity
)


async def chat(websocket):
    """Handle conversation with peers"""
    global NUMBER_OF_PEERS
    peer_index = await register(websocket)  # 1-based
    if not peer_index:
        # Should close the connection - not clean
        return
    peer_index = peer_index - 1  # 0-based
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
            PEERS[peer_index] = None
            NUMBER_OF_PEERS -= 1
            break
        print(f"Peer index {peer_index} <<< {message} <<< {user}")

        # Broadcast message to peers
        for peer in PEERS:
            if peer:
                await peer.send(f"{user}::{message}")
        # Send notification
        client_lambda.invoke(
            FunctionName=LAMBDA_NOTIFICATION_ARN,
            InvocationType="Event",
            Payload=json.dumps({"room_id": ROOM_ID}),
        )


async def register(websocket):
    """Register websocket on first connect"""
    global NUMBER_OF_PEERS
    if NUMBER_OF_PEERS >= MAX_PEERS:
        return False
    # Alert other peers
    print(f"Peer {len(PEERS)} just entered the chat")
    for peer in PEERS:
        if peer:
            await peer.send("0::Quelqu'un a rejoint la conversation!")
    # Send notification
    client_lambda.invoke(
        FunctionName=LAMBDA_NOTIFICATION_ARN,
        InvocationType="Event",
        Payload=json.dumps({"room_id": ROOM_ID}),
    )
    # Add peer to active sockets
    PEERS.append(websocket)
    NUMBER_OF_PEERS += 1
    return len(PEERS)


# ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
# localhost_pem = pathlib.Path(__file__).with_name("localhost.pem")
# ssl_context.load_cert_chain(localhost_pem)


async def server():
    """Start websocket server"""
    print(f"Start server #{ROOM_ID} on port 8765")
    # TODO: add try, except asyncio.CancelledError:, finally to close the server properly
    async with websockets.serve(chat, "0.0.0.0", 8765):  # , ssl=ssl_context):
        await asyncio.Future()  # Run forever


async def alive():
    """Check periodically if there is still user on the conversation"""
    await asyncio.sleep(ALIVE_INITIAL_DELAY)
    while NUMBER_OF_PEERS > 0:
        # TODO: Add date-time on print
        print(f"Server #{ROOM_ID} is alive with {NUMBER_OF_PEERS} peers connected.")
        await asyncio.sleep(ALIVE_DELAY)


async def main():
    """Main task"""
    # Start server
    server_task = asyncio.create_task(server())
    alive_task = asyncio.create_task(alive())

    def cancel_server_task(_):
        print("Close the server: no user left")
        server_task.cancel()

    alive_task.add_done_callback(cancel_server_task)

    await server_task
    await alive_task


if __name__ == "__main__":
    asyncio.run(main())
