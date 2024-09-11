#!/bin/bash

echo -e "\nRemoving all containers"
docker rm "$(docker ps -a -q)"

echo -e "\nRemoving all images"
docker rmi -f "$(docker images -a -q)"
