#!/usr/local/bin/bash

# Store the folder path in a variable
folder=$1

# Initialize an associative array to store the suffixes, the dimensions of the first image, and the number of images for each suffix
declare -A suffix_info

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
    echo "Error: Images with suffix $suffix in the folder have different dimensions."
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
