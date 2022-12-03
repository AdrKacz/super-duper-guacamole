#!/bin/zsh
# Upgrade and install dependencies in a package

if [ -f 'package-lock.json' ]; then
    echo "Install project in $(pwd)"
    npm install
fi