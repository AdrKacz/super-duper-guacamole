#!/bin/bash

# Example usage: bash npm-multiple-folders.sh package.json install

# Root directory to start searching for the specified file
ROOT_DIR=$(pwd)

# Check if a file name and npm command are passed as arguments
if [[ $# -ne 2 ]] ; then
    echo 'Please provide a file name and an npm command to run as arguments'
    exit 1
fi

# Find all directories containing the specified file within the root directory, excluding the root directory itself
DIRS=$(find "$ROOT_DIR" -name "$1" -type f -not -path "*/node_modules/*" -not -path "*/.aws-sam/*" -exec dirname {} \; | sort -u | grep -v "^$ROOT_DIR$")


# Loop through each directory and run the specified npm command
for DIR in $DIRS
do
  echo "Running $2 in $DIR"
  cd "$DIR"
  yarn "$2"
done
