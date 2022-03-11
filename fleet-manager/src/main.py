from typing import Optional

from fastapi import FastAPI

import docker
client = docker.from_env()

app = FastAPI()


@app.get("/")
def read_root():
    return {"Fleet": "Manager"}


@app.get("/containers")
def read_containers():
    containers_id = []
    for container in client.containers.list():
        print(container)
        containers_id.append(container.id)
    return {"containers_id": containers_id}
