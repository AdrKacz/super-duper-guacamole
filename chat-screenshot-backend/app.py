#!./chat-screenshot-backend/.venv/bin/python3.9

import asyncio
import websockets
import json
from datetime import datetime
from math import floor

message_count = 0
def encodeMessage(author, created_at_isoformat, text):
    global message_count
    message_count += 1

    created_at_datetime = datetime.fromisoformat(created_at_isoformat)
    return f"{author}::{floor(created_at_datetime.timestamp() * 1000)}::text-{message_count}::{text}"

seen_ids = set()
async def register(websocket):
    global seen_ids
    message = await websocket.recv()
    print(">>>", message)

    body = json.loads(message)
    user_id = body['id']
    if (user_id in seen_ids):
        answer = json.dumps({
        'action':'register',
        'group': 'group-screenshot',
        'unreadData':[],
        })
        print("<<<", answer)
        await websocket.send(answer)
        await asyncio.Future()
    seen_ids.add(user_id)

    answer = json.dumps({
        'action':'register',
        'group': 'group-screenshot',
        'unreadData':[
            {
                'action': 'joingroup',
                'groupid': 'group-screenshot',
                'users': {
                    user_id: {
                        'id': user_id,
                        'isActive': True
                    },
                    'user-01': {
                        'id': 'user-01',
                        'isActive': True
                    },
                    'user-02': {
                        'id': 'user-02',
                        'isActive': False
                    },
                    'user-03': {
                        'id': 'user-03',
                        'isActive': True
                    },
                }
            },
            {
                'action': 'textmessage',
                'message': encodeMessage('user-01', '2022-06-10 16:20:00+01:00', 'Bonjour')
            },
            {
                'action': 'textmessage',
                'message': encodeMessage('user-02', '2022-06-10 16:25:00+01:00', "Hello")
            },
            {
                'action': 'textmessage',
                'message': encodeMessage('user-01', '2022-06-10 16:28:00+01:00', "Hola")
            },
            {
                'action': 'textmessage',
                'message': encodeMessage(user_id, '2022-06-10 16:29:00+01:00', "Hey")
            }
        ]
    })
    print("<<<", answer)
    await websocket.send(answer)
    await asyncio.Future()

async def main():
    print(f"Run websocket at ws://localhost:8765")
    async with websockets.serve(register, "localhost", 8765):
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    asyncio.run(main())
