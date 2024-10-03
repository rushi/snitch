## GoCD Snitch

A webhook based Slack notifier for [GoCD](https://www.gocd.org/)

## Requirements

-   Node 20
-   Webhook GoCD plugin: https://github.com/digitalocean/gocd-webhook-notification-plugin

## Install

```shell
docker build -t snitch .
docker run -p 6000:6000 -it snitch
```

Create/Edit `/var/go/webhook_notify.properties` file and add an entry for the webhook. Example:

```ini
stage.status.endpoint.1=https://your-snitch-url/api/webhooks
agent.status.endpoint.1=https://your-snitch-url/api/webhooks
```

## Deploy on Remote server

Run `scripts/release.sh` This will build and run the app. The app is made of three components configured in `pm2.config.cjs`:

1. Snitch app
2. Monitoring agent for Jobs
3. Monitoring agent for Elastic agents

Once run you can view the logs using:

```
docker logs -f snitch
```
