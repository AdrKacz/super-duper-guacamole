# Fleet Manager

Fleet Manager is running on the *LightSail* instance that runs the *Docker containers*.
It offers an **API** to **open** and **close** container.

This **API** will be used by the **match-maker** to create new room as player came in.

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
uvicorn main:app
```

# Upload to AWS Lightsail

## Local

```sh
cd fleet-manager
zip -r fleet-manager.zip ./src
```

# Instance

> Make sure `tmux` is installed: `yum install tmux`and `tmux --version`

> Do not open the port 8000 publicly, it will only be used by the **match-maker** locally

```sh
# Download zip at https://github.com/AdrKacz/super-duper-guacamole/raw/dev-matchmaker/fleet-manager/fleet-manager.zip
```