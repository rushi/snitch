ARG NODE_VERSION=20
FROM node:${NODE_VERSION}-bookworm-slim AS builder

RUN apt-get update && apt-get install -y make

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --include=dev

COPY . .

FROM node:${NODE_VERSION}-bookworm-slim AS base
RUN apt-get update && apt-get install -y make
WORKDIR /app

RUN chown -R node:node /app

ARG NODE_ENV=development
ENV NODE_ENV=${NODE_ENV}

# Change to actual port
EXPOSE 6000

# From: https://docs.docker.com/language/nodejs/develop/#update-your-dockerfile-for-development
FROM base AS dev
RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
    --mount=type=cache,target=/root/.npm \
    npm config set update-notifier false && npm ci --include=dev
USER node
COPY --chown=node:node . .

CMD ["npm", "start"]

FROM base AS prod

COPY --from=builder /app/config ./config

COPY package.json package-lock.json ./

RUN npm ci --no-audit --omit=dev
COPY --chown=node:node . .

RUN npm install -g pm2 --no-fund --no-audit --no-update-notifier

RUN chown -R node:node /app
USER node

CMD ["pm2-runtime", "start", "npm", "--", "start"]
