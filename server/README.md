# WebSocket Server

### Development

```sh
# zsh
cd server
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install websockets
```

```sh
# list open ports
lsof -i -P -n | grep LISTEN
```