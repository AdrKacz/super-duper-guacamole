from typing import Optional

from fastapi import FastAPI

import requests

app = FastAPI()

MAXIMUM_ROOM_SIZE = 4

current_room_address : str = None
current_room_port : int = None
current_room_size : int = MAXIMUM_ROOM_SIZE

def create_new_room():
    # host.docker.internal works on macOS - not tested in Amazon Linux 2 instance
    # See https://stackoverflow.com/questions/24319662/from-inside-of-a-docker-container-how-do-i-connect-to-the-localhost-of-the-mach
    # 172.17.0.1, work on Linux
    # See https://stackoverflow.com/questions/48546124/what-is-linux-equivalent-of-host-docker-internal
    r = requests.get("http://host.docker.internal:8000")
    print(r.json())
    return "13.37.214.198", 8081

@app.get("/")
def read_root():
    return {"Match": "Maker"}

@app.get("/room/{user_id}")
def read_room(user_id : str):
    global current_room_address, current_room_port, current_room_size
    if current_room_size >= MAXIMUM_ROOM_SIZE:
        # Reset and new room
        current_room_size = 0
        current_room_address, current_room_port = create_new_room()
    current_room_size += 1
    return {"user_id": user_id, "room_address": current_room_address, "room_port": current_room_port}



