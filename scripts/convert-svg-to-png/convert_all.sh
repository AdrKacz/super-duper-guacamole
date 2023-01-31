#!/bin/zsh
# convert all the svg in a folder to png in another folder
# argument 1 - origin folder (with trailing '/')
# argument 2 - destination folder (with trailing '/')

for file in $1*.svg; do
    rsvg-convert -h 512 $file > $2$(basename $file .svg).png
done

