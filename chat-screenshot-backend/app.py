#!./chat-screenshot-backend/.venv/bin/python3.9

import asyncio
import websockets
import json
from datetime import datetime
from math import floor
from uuid import uuid4

message_count = 0
def encodeMessage(author, created_at_isoformat, text):
    global message_count
    message_count += 1

    created_at_datetime = datetime.fromisoformat(created_at_isoformat)
    return f"{author}::{floor(created_at_datetime.timestamp() * 1000)}::text-{message_count}::{text}"

seen_ids = set()
snapshot = {}
async def register(websocket):
    global seen_ids, snapshot
    message = await websocket.recv()
    # print(">>>", message)

    body = json.loads(message)
    user_id = body['id']
    print(f"Receive register from {user_id}")
    if (user_id in seen_ids):
        answer = json.dumps({
        'action':'register',
        'group': 'group-screenshot',
        'unreadData':[],
        })
        print(f"User {user_id} already seen")
        # print("<<<", answer)
        await websocket.send(answer)
        await asyncio.Future()
    seen_ids.add(user_id)

    unreadData = list()
    # create users
    users = {user_id: {
        'id': user_id,
        'isActive': True
    }}
    usersMap = list()
    for status in snapshot['isActiveUsers']:
        id = str(uuid4())
        users[id] = {
            'id': id,
            'isActive': status
        }
        usersMap.append(id)

    unreadData.append({
                'action': 'joingroup',
                'groupid': 'group-screenshot',
                'users': users
    })
    # create messages
    for message in snapshot['messages']:
        if message['author'] == 0:
            author = user_id
        else:
            author = usersMap[message['author'] - 1]
        unreadData.append({
            'action': 'textmessage',
            'message': encodeMessage(author, message['datetime'], message['text'])
        })

    answer = json.dumps({
        'action':'register',
        'group': 'group-screenshot',
        'unreadData': unreadData
    })
    print(f"Send conversation to {user_id}")
    await websocket.send(answer)
    await asyncio.Future()

async def main():
    print(f"Run websocket at ws://localhost:8765")
    async with websockets.serve(register, "localhost", 8765):
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    # get instruction
    with open('snapshot.json') as f:
        snapshot = json.load(f)
    asyncio.run(main())
