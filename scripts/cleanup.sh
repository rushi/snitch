#!/bin/bash

# echo -e "\nRemoving all containers"
# docker rm "$(docker ps -a -q)"

echo -e "\nRemoving all images"
docker image prune -a
