#!/bin/bash

# Pull updated images
docker pull adrkacz/awa-match-maker:latest
docker pull adrkacz/awa-server:python

# Run matchmaker
docker run -dp $3:8080 adrkacz/awa-match-maker:latest

# Run fleet manager
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
source venv/bin/activate
echo "Enter Ctrl+b d after uvicorn starts"
uvicorn src.main:app --host 0.0.0.0 --port 8000