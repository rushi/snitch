#!/bin/bash

IMAGE_NAME="snitch"
CONTAINER_NAME="snitch"

echo -e "Building image \033[32m'${IMAGE_NAME}'\033[0m"
docker build -t $IMAGE_NAME . || exit

echo -e "\nCurrent images:"
docker image ls || exit

echo -e "\nRunning containers:"
docker ps -a
docker stop $CONTAINER_NAME

echo -e "\n\033[32mStarting ${CONTAINER_NAME}:\033[0m"
docker run --name $CONTAINER_NAME --rm -d -p 6000:6000 $IMAGE_NAME
echo -e "\n$(docker ps -a)"

echo -e "\nRun 'docker logs -f ${CONTAINER_NAME}' to show logs\n"
