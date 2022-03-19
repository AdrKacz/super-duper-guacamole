from multiprocessing.sharedctypes import Value
from typing import Optional

from fastapi import FastAPI

import docker
client = docker.from_env()

app = FastAPI()

# Make sure the image is already pulled
CONTAINER_IMAGE = "adrkacz/awa-server:python"

# from_port - to_port, inclusive
# TODO: from_port and to_port environemenet variable
from_port : int = 8081
to_port : int = 8082
ports = [False] * (to_port - from_port + 1)

# room count
room_created : int = 0

def update_active_ports():
    global ports, from_ports
    print("Update active ports")
    ports = [False] * (to_port - from_port + 1)
    for container in client.containers.list(all=True, ignore_removed=True):
        print("Container:", container.id)
        tags = container.image.tags
        if CONTAINER_IMAGE in tags:
            if container.status == "running":
                container_ports = container.ports.get("8765/tcp", [])
                if len(container_ports) > 0:
                    local_port = int(container_ports[0].get("HostPort", "0"))
                    if local_port:
                        local_index = local_port - from_port
                        print(f"\tAdd running container {container.short_id}.")
                        ports[local_index] = container.id


@app.get("/")
def read_root():
    return {"Fleet": "Manager"}

@app.get("/container")
def read_container():
    global room_created
    # Update active ports
    update_active_ports()
                    
    # Create container
    print("Create container")
    try:
        local_index = ports.index(False) # Get the first unsused port
        print("Run container at port:", from_port + local_index)
        # TODO: catch error if port already allocated
        container = client.containers.run(CONTAINER_IMAGE, auto_remove=True, detach=True, ports={"8765/tcp": from_port + local_index})
        ports[local_index] = container.id
        room_created += 1
        return {"port": from_port + local_index, "room_id": room_created}
    except ValueError:
        return {"error": "no available space"}

@app.get("/containers")
def read_containers():
    containers = {}
    for container in client.containers.list(all=True):
        print("Container:", container.id)
        print("\tImage:", container.image)
        print("\tPorts:", container.ports)
        containers[container.id] = str(container.image)
    return containers

@app.get("/clear-all-containers")
def clear_all_containers():
    for container in client.containers.list(all=True, ignore_removed=True):
        print("Container:", container.id)
        tags = container.image.tags
        if CONTAINER_IMAGE in tags:
            container.remove(force=True)


# The following is useful if auto_remove flag is false (to remove exited one by one instead of on the fly)
# def update_active_ports():
#     global ports, from_port
#     print("Update active ports")
#     for container in client.containers.list(all=True, ignore_removed=True):
#         print("Container:", container.id)
#         tags = container.image.tags
#         if CONTAINER_IMAGE in tags:
#             if container.status == "exited":
#                 try:
#                     local_index = ports.index(container.id)
#                     ports[local_index] = False
#                     print(f"\tRemove exited container {container.short_id}.")
#                 except ValueError:
#                     print(f"\tExited container {container.short_id} wasn't in current ports. Remove it anyway.")
#                 container.remove()
#             elif container.status == "running":
#                 container_ports = container.ports.get("8765/tcp", [])
#                 if len(container_ports) > 0:
#                     local_port = int(container_ports[0].get("HostPort", "0"))
#                     if local_port:
#                         local_index = local_port - from_port
#                         if not ports[local_index]:
#                             print(f"\tRunning container {container.short_id} was't in current ports. Add it")
#                             ports[local_index] = container.id