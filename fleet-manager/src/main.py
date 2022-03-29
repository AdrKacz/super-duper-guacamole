"""
Fleet manager of Awa server
API to managed Docker containers
- / > Hello world
- /container > create a new server container
- /containers > list all containers
- /clear-all-containers > clear all server containers
"""
# from multiprocessing.sharedctypes import Value
# from typing import Optional
import os
from fastapi import FastAPI
import docker

LAMBDA_NOTIFICATION_ARN = os.getenv('LAMBDA_NOTIFICATION_ARN')
HOME = os.getenv('HOME')
FROM_PORT : int = int(os.getenv('FROM_PORT'))
TO_PORT : int = int(os.getenv('TO_PORT'))
print("ENVIRONMENT\n===== ===== =====")
print("LAMBDA_NOTIFICATION_ARN:", LAMBDA_NOTIFICATION_ARN)
print("HOME:", HOME)
print("FROM_PORT:", FROM_PORT)
print("TO_PORT:", TO_PORT)
print("===== ===== =====")

client = docker.from_env()

app = FastAPI()

# Make sure the image is already pulled
CONTAINER_IMAGE = "adrkacz/awa-server:python"

# FROM_PORT and TO_PORT included
PORTS = [False] * (TO_PORT - FROM_PORT + 1)

# room count - used for room id
ROOM_CREATED : int = 0

def update_active_ports():
    """Update list of active containers with their ports"""
    global PORTS
    print("Update active ports")
    PORTS = [False] * (TO_PORT - FROM_PORT + 1)
    for container in client.containers.list(all=True, ignore_removed=True):
        print("Container:", container.id)
        tags = container.image.tags
        if CONTAINER_IMAGE in tags:
            if container.status == "running":
                container_ports = container.ports.get("8765/tcp", [])
                if len(container_ports) > 0:
                    local_port = int(container_ports[0].get("HostPort", "0"))
                    if local_port:
                        local_index = local_port - FROM_PORT
                        print(f"\tAdd running container {container.short_id}.")
                        PORTS[local_index] = container.id


@app.get("/")
def read_root():
    """Hello world"""
    return {"Fleet": "Manager"}

@app.get("/container")
def read_container():
    """Create a new container"""
    global ROOM_CREATED
    # Update active ports
    update_active_ports()

    # Create container
    print("Create container")
    try:
        local_index = PORTS.index(False) # Get the first unsused port
        print("Run container at port:", FROM_PORT + local_index)
        # TODO: catch error if port already allocated
        ROOM_CREATED += 1
        container = client.containers.run(
            CONTAINER_IMAGE,
            auto_remove=True,
            detach=True,
            ports={"8765/tcp": FROM_PORT + local_index},
            environment={
                "MAX_PEERS": 5,
                "ROOM_ID": ROOM_CREATED,
                "LAMBDA_NOTIFICATION_ARN": LAMBDA_NOTIFICATION_ARN
                },
            volumes=[f"{HOME}/.aws:/root/.aws:ro"])
        PORTS[local_index] = container.id
        return {"port": FROM_PORT + local_index, "room_id": ROOM_CREATED}
    except ValueError:
        return {"error": "no available space"}

@app.get("/containers")
def read_containers():
    """Returns all containers"""
    containers = {}
    for container in client.containers.list(all=True):
        print("Container:", container.id)
        print("\tImage:", container.image)
        print("\tPorts:", container.ports)
        containers[container.id] = str(container.image)
    return containers

@app.get("/clear-all-containers")
def clear_all_containers():
    """Remove all containers"""
    for container in client.containers.list(all=True, ignore_removed=True):
        print("Container:", container.id)
        tags = container.image.tags
        if CONTAINER_IMAGE in tags:
            container.remove(force=True)
            