#!/bin/zsh
# Upgrade and install dependencies

# Store current directory
base_directory=$(pwd)
echo "===== ===== =====\nBase Directory: $(pwd)\n"

# .dependencies
cd "${base_directory}/.dependencies"
echo "Update in $(pwd)"
for f in *; do
    if [ -d "$f" ]; then
        echo "----- ----- -----\n$f"
        # Will not run if no directories are available
        cd $f
        [[ -f 'nodejs/package.json' ]] && npm update
        cd ..
    fi
done

# actions
cd "${base_directory}/actions"
echo "Update in $(pwd)"
for f in *; do
    if [ -d "$f" ]; then
        # Will not run if no directories are available
        echo "----- ----- -----\n$f"
        cd $f
        [[ -f 'package.json' ]] && npm update
        cd ..
    fi
done

# root
cd "${base_directory}/"
echo "Update in $(pwd)"
for f in *; do
    if [ -d "$f" ]; then
        # Will not run if no directories are available
        echo "----- ----- -----\n$f"
        cd $f
        [[ -f 'package.json' ]] && npm update
        cd ..
    fi
done

# cd .dependencies
# cd aws-sdk-api/nodejs
# npm update
# cd ../../aws-sdk-ddb/nodejs
# npm update
# cd ../../aws-sdk-sns/nodejs
# npm update
# cd ../../firebase-admin/nodejs
# npm update
# cd ../../../

# # Return to root and build
# sam build