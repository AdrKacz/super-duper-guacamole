#!/bin/zsh
# Upgrade and install dependencies

# Read arguments
mode="dev"
while getopts m: flag
do
    case "${flag}" in
        m) mode=${OPTARG};;
    esac
done

# Store current directory
base_directory=$(pwd)
echo "===== ===== =====\nBase Directory: $(pwd)\n"
if [ $mode = "dev" ] && [ -f 'package.json' ]; then
    echo "Update project"
    yarn upgrade
fi

# .dependencies
cd "${base_directory}/.dependencies"
echo "Update in $(pwd)"
for f in *; do
    if [ -d "$f" ] && [ -d "$f/nodejs" ]; then
        cd $f/nodejs
        echo "\n\n----- ----- -----\n$(pwd)"
        # Will not run if no package are available
        if [ $mode = "ci" ] && [ -f 'package-lock.json' ]; then
            echo "Clean install project"
            npm ci
        elif [ $mode = "dev" ] && [ -f 'package.json' ]; then
            echo "Update project"
            npm update
        fi
        cd ../..
    fi
done

# actions
cd "${base_directory}/actions"
echo "Update in $(pwd)"
for f in *; do
    if [ -d "$f" ]; then  
        echo "\n\n----- ----- -----\n$(pwd)"
        cd $f
        # Will not run if no package are available
        if [ $mode = "ci" ] && [ -f 'package-lock.json' ]; then
            echo "Clean install project"
            npm ci
        elif [ $mode = "dev" ] && [ -f 'package.json' ]; then
            echo "Update project"
            npm update
        fi
        cd ..
    fi
done

# root
cd "${base_directory}/"
echo "Update in $(pwd)"
for f in *; do
    if [ -d "$f" ]; then
        echo "\n\n----- ----- -----\n$(pwd)"
        cd $f
        # Will not run if no package are available
        if [ $mode = "ci" ] && [ -f 'package-lock.json' ]; then
            echo "Clean install project"
            npm ci
        elif [ $mode = "dev" ] && [ -f 'package.json' ]; then
            echo "Update project"
            npm update
        fi
        cd ..
    fi
done

# Return to root and build
cd "${base_directory}/"