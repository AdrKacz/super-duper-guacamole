from typing import Optional

from fastapi import FastAPI, Response
from fastapi.responses import JSONResponse

import requests

app = FastAPI()

MAXIMUM_ROOM_SIZE = 2
IP_ADDRESS = "13.37.214.198"

current_room_address : str = None
current_room_port : int = None
current_room_size : int = MAXIMUM_ROOM_SIZE

def create_new_room():
    print("Create new room")
    # host.docker.internal works on macOS - not tested in Amazon Linux 2 instance
    # See https://stackoverflow.com/questions/24319662/from-inside-of-a-docker-container-how-do-i-connect-to-the-localhost-of-the-mach
    # 172.17.0.1, work on Linux
    # See https://stackoverflow.com/questions/48546124/what-is-linux-equivalent-of-host-docker-internal
    r = requests.get("http://172.17.0.1:8000/container")
    response = r.json()
    port = response.get("port", 0)
    if port:
        # TODO: replace 127.0.0.1 by environment variable
        print("\tport:", port)
        return IP_ADDRESS, port, ""
    else:
        error = response.get("error", "unknown error")
        print("\terror:", error)
        return "", 0, error

@app.get("/")
def read_root():
    return {"Match": "Maker"}

@app.get("/room/{user_id}", status_code=200)
def read_room(user_id : str, response: Response):
    global current_room_address, current_room_port, current_room_size
    error = ""
    if current_room_size >= MAXIMUM_ROOM_SIZE:
        # Reset and new room
        current_room_size = 0
        current_room_address, current_room_port, error = create_new_room()
        if error:
            current_room_size = MAXIMUM_ROOM_SIZE # to force creation a next call
            response.status_code = 200 # TODO: use status.NO_CONTENT
            # Error on 204 ContentLength: https://github.com/tiangolo/fastapi/issues/717
    current_room_size += 1
    return {"user_id": user_id, "room_address": current_room_address, "room_port": current_room_port, "error": error}



