# Run service locally

## Prepare environment

```sh
cd fleet-manager
rm -rf venv/
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install fastapi
pip install "uvicorn[standard]"
pip install docker
deactivate
cd ../matchmaker
docker build -t local-matchmaker .
cd ..
```

## Start service

```sh
docker run -dp 8080:8080 local-matchmaker
cd fleet-manager
source venv/bin/activate
uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
```

# Update AWS

## Prepare image locally

```sh
sh scripts/build-all.sh <path-to-your-ssh-key> <instance-ip-address> <dockerhub-username>
```

## Update your instance

### Step 1. Connect to your instance

```sh
ssh -i <path-to-your-ssh-key> ec2-user@<instance-ip-address>
```

### Step 2. Start Matchmaker and prepare Fleet manager

> **WARNING**: close all running Docker container.

> **WARNING**: shut down fleet manager if it is already running

```sh
docker pull adrkacz/awa-match-maker:latest
docker pull adrkacz/awa-server:python
docker run -dp 8080:8080 -e MAXIMUM_ROOM_SIZE=$MAXIMUM_ROOM_SIZE -e IP_ADDRESS=$IP_ADDRESS -e HOST_ADDRESS=$HOST_ADDRESS adrkacz/awa-match-maker:latest 
cd fleet-manager
rm -rf src/ venv/
unzip fleet-manager.zip
rm fleet-manager.zip
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install fastapi
pip install "uvicorn[standard]"
pip install docker
deactivate
tmux
```

> 8080: `<instance-api-port>`


### Step 3. Run Fleet manager

```
source venv/bin/activate
echo -e "\033[0;35mEnter Ctrl+b d after uvicorn starts\033[0m"
uvicorn src.main:app --host 0.0.0.0 --port 8000
```