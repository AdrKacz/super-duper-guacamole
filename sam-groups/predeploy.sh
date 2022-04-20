#!/bin/zsh

# Install dependencies for Lambda Layers
cd .dependencies
cd aws-sdk
npm install
cd ../firebase
npm install
cd ../../

# Return to root and build
sam build