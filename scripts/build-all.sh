#!/bin/zsh

if [ "$USER" == "ec2-user" ]
then
    echo "User is not ec2-user."
    exit
fi

# Fleet manager
cd fleet-manager
rm -rf src/__pycache__/
zip -r fleet-manager.zip ./src
scp -i $1 fleet-manager.zip ec2-user@$2:fleet-manager/
rm fleet-manager.zip
cd ..
# Prepare docker (not needed, already logged in)
# docker login -u $3
# Matchmaker
cd matchmaker
docker build -t adrkacz/awa-match-maker:latest .
docker push adrkacz/awa-match-maker:latest
cd ..
# Awa chat server
cd awa-chat-server-python
docker build -t adrkacz/awa-server:python .
docker push adrkacz/awa-server:python
cd ..