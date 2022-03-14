# Fleet Manager

Fleet Manager is running on the *LightSail* instance that runs the *Docker containers*.
It offers an **API** to **open** and **close** container.

This **API** will be used by the **matchmaker** to create new room as player came in.

> That may not be the most efficient method, but it will be enought for now.

# Development

```sh
cd fleet-manager
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install fastapi
pip install "uvicorn[standard]"
pip install docker
```

# Run the server

```sh
uvicorn src.main:app --host 0.0.0.0 --port 8000
# or, for debugging
uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
```

> Go to [http://127.0.0.1:8000/docs]() to play with your API.

# Upload to AWS Lightsail

## Local

```sh
cd fleet-manager
zip -r fleet-manager.zip ./src
```

# Instance

> Make sure `tmux` is installed: `yum install tmux`and `tmux --version`

> Do not open the port 8000 publicly, it will only be used by the **match-maker** locally

## Copy development to your instance

### Local

```sh
cd fleet-manager
rm -rf src/__pycache__/
zip -r fleet-manager.zip ./src
scp -i <path-to-your-key> fleet-manager.zip ec2-user@<public-ip>:fleet-manager/
rm fleet-manager.zip
```

### Remote

```sh
# Connec to your instance
ssh -i <path-to-your-key> ec2-user@<public-ip>
```

```sh
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
uvicorn src.main:app --host 0.0.0.0 --port 8000
# Ctrl+b d
```

> Use `tmux ls` to see active sessions and `tmux attach-session -t <session-id>` to activate session
