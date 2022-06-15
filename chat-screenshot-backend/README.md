# Chat Screenshot Backend

Local backend that sends a list of instruction to the app so it displays the desire state.


## Setup environement
```sh
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install websockets
pip install pyyaml
# ...
deactivate # to close your environment
```

## How to use it
```sh
python app.py --help
python app.py # will use default snapshots/snapshot.yaml
python app.py -s snapshots/my-snapshot.yaml
python app.py --snapshot my-other-snapshot.yaml
```