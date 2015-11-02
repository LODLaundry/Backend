#!/bin/bash



[ -z "$1" ] && echo "No dataset provided as argument" && exit 1;

renice -n 10 $$
/home/lodlaundromat/bin/wm-callback-verbose.sh $1 >> /home/lodlaundromat/log/wmCallback.log 2>> /home/lodlaundromat/log/wmCallback.err;

