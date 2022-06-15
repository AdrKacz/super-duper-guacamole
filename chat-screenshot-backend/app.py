#!./chat-screenshot-backend/.venv/bin/python3.9

"""
Mock the real backend architecture

Send a pre-defined series of messages.
Don't react to any input from the client.
"""

from argparse import ArgumentParser
import json
from math import floor
from uuid import uuid4
import asyncio

import yaml
import websockets

# ----- ----- ----- ----- -----
# ----- ----- ----- ----- -----
# COMAND LINE ARGUMENT
parser = ArgumentParser(description="Mock Awa-Chat websocket server for snapshots")
parser.add_argument(
    "-s",
    "--snapshot",
    dest="snapshot",
    default="./snapshots/snapshot.yaml",
    help="Snapshot YAML input",
    metavar="filename.yaml",
)

# ----- ----- ----- ----- -----
# ----- ----- ----- ----- -----
# WEB SOCKET
MESSAGE_COUNT = 0


def encode_message(author, datetime, text):
    """
    Encode message so it can be read by the app
        author : String - author id
        create_at_isoformat : String - datetime of the message in isoformat
        text : String - text of the message
    """
    global MESSAGE_COUNT
    MESSAGE_COUNT += 1

    return f"{author}::{floor(datetime.timestamp() * 1000)}::\
text-{MESSAGE_COUNT}::{text}"


SEEN_IDS = set()
SNAPSHOT = {}


async def register(websocket):
    """
    Receive register action and reply the series of messages
        websocket - connection automatically sent by main
    """
    global SEEN_IDS, SNAPSHOT
    message = await websocket.recv()

    body = json.loads(message)
    user_id = body["id"]
    print(f"Receive register from {user_id}")
    if user_id in SEEN_IDS:
        answer = json.dumps(
            {
                "action": "register",
                "group": "group-screenshot",
                "unreadData": [],
            }
        )
        print(f"User {user_id} already seen")
        await websocket.send(answer)
        await asyncio.Future()
    SEEN_IDS.add(user_id)

    unread_data = []
    # create users
    users = {user_id: {"id": user_id, "isActive": True}}
    users_map = []
    for status in SNAPSHOT["isActiveUsers"]:
        other_user_id = str(uuid4())
        users[other_user_id] = {"id": other_user_id, "isActive": status}
        users_map.append(other_user_id)

    unread_data.append(
        {"action": "joingroup", "groupid": "group-screenshot", "users": users}
    )
    # create messages
    for message in SNAPSHOT["messages"]:
        if message["author"] == 0:
            author = user_id
        else:
            author = users_map[message["author"] - 1]
        unread_data.append(
            {
                "action": "textmessage",
                "message": encode_message(author, message["datetime"], message["text"]),
            }
        )

    answer = json.dumps(
        {"action": "register", "group": "group-screenshot", "unreadData": unread_data}
    )
    print(f"Send conversation to {user_id}")
    await websocket.send(answer)
    await asyncio.Future()


async def main():
    """
    Start the websocket server
    """
    print("Run websocket at ws://localhost:8765")
    async with websockets.serve(register, "localhost", 8765):
        await asyncio.Future()  # run forever


# ----- ----- ----- ----- -----
# ----- ----- ----- ----- -----
# MAIN
if __name__ == "__main__":
    # get instruction
    args = parser.parse_args()
    with open(args.snapshot, "r", encoding="utf8") as stream:
        SNAPSHOT = yaml.safe_load(stream)
    asyncio.run(main())
