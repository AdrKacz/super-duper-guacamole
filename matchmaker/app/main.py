"""
Matchmacker matches user in room according to their preferences
- / > Hello world
- /room/{user_id} > get room for given user (NO PREFERENCES YET)
"""
# TODO: ROOMS keep growing indefinetely, need a way to clear the object from time to time

# from typing import Optional
from fastapi import FastAPI
import requests
import os

MAXIMUM_ROOM_SIZE = int(os.getenv('MAXIMUM_ROOM_SIZE'))
IP_ADDRESS = os.getenv('IP_ADDRESS')
print("ENVIRONMENT\n===== ===== =====")
print("MAXIMUM_ROOM_SIZE:", MAXIMUM_ROOM_SIZE)
print("IP_ADDRESS:", IP_ADDRESS)
print("===== ===== =====")

app = FastAPI()

ROOMS = {}

def response_from_room_id(user_id, room_id):
    """JSON response formatted"""
    return  {
        "user_id": user_id,
        "room_id": room_id,
        "room_address": ROOMS[room_id]['address'],
        "room_port": ROOMS[room_id]['port'],
        }

def create_new_room():
    """Create a new room with the fleet manager"""
    print("Create new room")
    raw = requests.get("http://172.17.0.1:8000/container") # Host container address
    response = raw.json()
    room_id = response.get("room_id", 0)
    port = response.get("port", 0)
    error = ""
    if port:
        print("\tport:", port)
    else:
        error = response.get("error", "unknown error")
        print("\terror:", error)
    return room_id, IP_ADDRESS, port, error

@app.get("/")
def read_root():
    """Hello World"""
    return {"Match": "Maker"}

@app.get("/room/{user_id}")
def read_room(user_id : str):
    """Get room for given user"""
    error = ""
    for room_id, room in ROOMS.items():
        if len(room['users']) < MAXIMUM_ROOM_SIZE and user_id not in room['users']:
            # Room pass criteria, return it
            room['users'].append(user_id)
            return response_from_room_id(user_id, room_id)

    # No room left, create one
    room_id, room_address, room_port, error = create_new_room()
    if error:
        return {"error": error}
    # else
    ROOMS[room_id] = {
        "address": room_address,
        "port": room_port,
        "users": [user_id]
    }
    return response_from_room_id(user_id, room_id)


@app.get("/rooms/")
def read_rooms():
    """Read all rooms"""
    return ROOMS
