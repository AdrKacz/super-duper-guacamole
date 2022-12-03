#!/bin/zsh
# Upgrade and install dependencies in a package

if [ -f 'package-lock.json' ]; then
    echo "Clean install project in $(pwd)"
    npm ci
fi