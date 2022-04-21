#!/bin/zsh

# Upgrade and install dependencies for Lambda Layers
cd .dependencies
cd aws-sdk-api/nodejs
npm update
cd ../../aws-sdk-ddb/nodejs
npm update
cd ../../aws-sdk-sns/nodejs
npm update
cd ../../firebase-admin/nodejs
npm update
cd ../../../

# Return to root and build
sam build