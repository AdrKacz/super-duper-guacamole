#!/bin/zsh
# Upgrade and install dependencies in all packages

# Store current directory
base_directory=$(pwd)
find . -name "node_modules" -prune -o -name ".aws-sam" -prune -o -name "package.json" -execdir pwd \; -execdir sh ${base_directory}/predeploy-package.sh \;