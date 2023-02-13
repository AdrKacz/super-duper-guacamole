#!/bin/bash

# Store the key-value pairs as elements in an array
declare -a dict

# Function to get the value of a key
function get_value() {
  local key=$1
  for pair in "${dict[@]}"; do
    local k="${pair%%:*}"
    local v="${pair#*:}"
    if [[ "$k" == "$key" ]]; then
      echo "$v"
      return 0
    fi
  done
  echo "Key not found: $key" >&2
  return 1
}

# Function to set the value of a key
function set_value() {
  local key=$1
  local value=$2
  local found=0
  for i in "${!dict[@]}"; do
    local k="${dict[$i]%%:*}"
    if [[ "$k" == "$key" ]]; then
      dict[$i]="$key:$value"
      found=1
      break
    fi
  done
  if [[ "$found" == 0 ]]; then
    dict+=("$key:$value")
  fi
}

# Example usage
set_value "key1" "value1"
set_value "key2" "value2"
set_value "key3" "value3"

value=$(get_value "key1")
echo "Key1: $value"

value=$(get_value "key2")
echo "Key2: $value"

value=$(get_value "key3")
echo "Key3: $value"

value=$(get_value "key4")
echo "Key4: $value"

# Function to set the value of a key
function set_value() {
  local key=$1
  local value=$2
  local found=0
  for i in "${!dict[@]}"; do
    local k="${dict[$i]%%:*}"
    if [[ "$k" == "$key" ]]; then
      dict[$i]="$key:$value"
      found=1
      break
    fi
  done
  if [[ "$found" == 0 ]]; then
    dict+=("$key:$value")
  fi
}

# Store the folder path in a variable
folder=$1

# Initialize an associative array to store the suffixes, the dimensions of the first image, and the number of images for each suffix
declare -A suffix_info
echo "$BASH_VERSION"
# Loop through all the images in the folder
for file in "$folder"/*
do
  # Extract the suffix from the file name
  suffix=$(echo "$file" | cut -d _ -f2- | cut -d . -f1)

  # Get the dimensions of the current image
  width=$(sips -g pixelWidth "$file" | awk '{print $2}')
  height=$(sips -g pixelHeight "$file" | awk '{print $2}')

  width=${width//$'\n'/}
  height=${height//$'\n'/}
  # If the dimensions of the first image for the current suffix have not been set yet, set them
  if [ -z "${suffix_info[$suffix]}" ]
  then
    suffix_info[$suffix]="$width x $height,1"
  else
    # Increment the number of images for the current suffix
    dimensions=$(echo "${suffix_info[$suffix]}" | cut -d , -f1)
    count=$(echo "${suffix_info[$suffix]}" | cut -d , -f2)
    count=$((count + 1))
    suffix_info[$suffix]="$dimensions,$count"
  fi

  # Compare the dimensions of the current image with the dimensions of the first image for the current suffix
  dimensions=$(echo "${suffix_info[$suffix]}" | cut -d , -f1)
  if [ "$dimensions" != "$width x $height" ]
  then
    # If the dimensions are different, print an error message and exit the script
    echo "Error: Images with suffix $suffix in $folder have different dimensions."
    exit 1
  fi
done

# If all the images have the same dimensions, check if they have the same number
suffixes=( "${!suffix_info[@]}" )
random_index=$((RANDOM % ${#suffixes[@]}))
random_suffix="${suffixes[$random_index]}"
random_count=$(echo "${suffix_info[$random_suffix]}" | cut -d , -f2)
for suffix in "${!suffix_info[@]}"; do
  count=$(echo "${suffix_info[$suffix]}" | cut -d , -f2)
  if [ "$count" != "$random_count" ]; then
    echo "Error: all values in the dictionary should be the same, but got different values" >&2
    exit 1
  fi
done

echo "There are ${#suffix_info[@]} group of ${random_count} images in $folder."
