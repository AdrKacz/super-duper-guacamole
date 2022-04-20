#!/bin/zsh

# Upgrade and install dependencies for Lambda Layers
cd .dependencies
cd aws-sdk-api
npm update
cd aws-sdk-ddb
npm update
cd aws-sdk-sns
npm update
cd ../firebase
npm update
cd ../../

# Return to root and build
sam build