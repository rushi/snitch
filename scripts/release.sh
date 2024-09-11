#!/bin/bash

CONTAINER_NAME="snitch"
IMAGE_NAME="snitch"

echo "Building image ${IMAGE_NAME}"
docker build -t $IMAGE_NAME . || exit
docker image ls || exit

docker ps -a
docker stop $CONTAINER_NAME
docker rm $CONTAINER_NAME
docker run --name $CONTAINER_NAME --rm -d -p 6000:6000 $IMAGE_NAME
