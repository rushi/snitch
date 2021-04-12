const express = require("express");
const { App, LogLevel, ExpressReceiver } = require("@slack/bolt");
const config = require("config");

const PipelineUpdateHandler = require("./handlers/PipelineUpdateHandler");

const receiver = new ExpressReceiver({
    signingSecret: process.env.SLACK_SIGNING_SECRET,
});

const app = new App({
    token: config.get("slack.token"),
    signingSecret: config.get("slack.signingSecret"),
    receiver,
    // logLevel: LogLevel.DEBUG,
});

app.action({ callback_id: "run_failed_jobs" }, async ({ ack, callback }) => {
    console.log("run_failed_jobs callback", callback?.value);
    await ack();
});

app.action("run_failed_jobs", async ({ ack, action }) => {
    console.log("run_failed_jobs action", action?.value);
    await ack();
});

const handlers = [PipelineUpdateHandler];

receiver.router.post("/api/webhooks", express.json(), async (request, response) => {
    const Handler = handlers.find((Handler) => {
        return Handler.shouldHandle(request);
    });

    if (Handler) {
        await new Handler(app).handle(request).catch((error) => {
            console.error(error);
        });
    }

    response.send({ status: "OK" });
});

receiver.router.post("/api/actions", express.json(), async (request, response) => {
    console.log(request.body);
});

app.start(3000).then(() => {
    console.log("Bot is running on port 3000");
});
