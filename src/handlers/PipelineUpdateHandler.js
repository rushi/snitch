const Pipeline = require("../models/Pipeline");
const PipelineFailedNotification = require("../templates/PipelineFailedNotification");
const config = require("config");
const Handler = require("./Handler");

class PipelineUpdateHandler extends Handler {
    static shouldHandle(request) {
        return !!request.body?.pipeline;
    }

    async handle(request) {
        const pipeline = new Pipeline(request.body.pipeline);

        if (!(await pipeline.shouldNotify())) {
            return;
        }

        const userChannel = await this.getChannelByEmail(pipeline.getCommitterEmail());

        if (!userChannel) {
            return;
        }

        // console.log(JSON.stringify(request.body, null, 2));
        const notification = new PipelineFailedNotification(pipeline).toJSON();

        console.log(`Notify ${userChannel}`);
        await this.app.client.chat.postMessage({
            token: config.get("slack.token"),
            channel: userChannel,
            ...notification,
        });
    }

    async getChannelByEmail(email) {
        if (config.get("whitelist.emails").includes(email)) {
            const result = await this.app.client.users.lookupByEmail({
                token: config.get("slack.token"),
                email,
            });

            return result.user?.id;
        }
    }
}

module.exports = PipelineUpdateHandler;
