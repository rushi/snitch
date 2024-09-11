## GoCD Snitch

A webhook based Slack notifier for [GoCD](https://www.gocd.org/)

## Requirements

-   Node 20
-   Webhook GoCD plugin: https://github.com/digitalocean/gocd-webhook-notification-plugin

## Install

Create/Edit `/var/go/webhook_notify.properties` file and add an entry for the webhook. Example:

```ini
stage.status.endpoint.1=https://your-snitch-url/api/webhooks
agent.status.endpoint.1=https://your-snitch-url/api/webhooks
```
