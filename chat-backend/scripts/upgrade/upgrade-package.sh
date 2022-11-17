#!/bin/zsh
# Upgrade and install dependencies in a package

if [ -f 'package-lock.json' ]; then
    echo "Upgrade project in $(pwd)"
    npm upgrade
fi