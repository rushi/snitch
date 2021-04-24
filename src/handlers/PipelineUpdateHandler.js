const path = require("path");
const Pipeline = require("../models/Pipeline");
const PipelineFailedNotification = require("../templates/PipelineFailedNotification");
const config = require("config");
const Handler = require("./Handler");
const Go = require("../services/go");

class PipelineUpdateHandler extends Handler {
    static shouldHandle(request) {
        return !!request.body?.pipeline;
    }

    async handle(request) {
        const pipeline = new Pipeline(request.body.pipeline);

        if (!(await pipeline.shouldNotify())) {
            return;
        }

        if (pipeline.hasSucceeded()) {
            const isFullyGreen = await Go.isEntirePipelineGreen(pipeline.getName());
            pipeline.set("isFullyGreen", isFullyGreen);
            if (!isFullyGreen) {
                return;
            }
        }

        if (pipeline.hasFailed() && pipeline.getFailedJobs().length < 10) {
            const failures = new Set();
            const junitJobs = await pipeline.getJunitJSON();
            junitJobs.forEach((junit) => {
                const suites = junit.suites.filter((s) => s.testCases && (s.errors > 0 || s.failures > 0));
                suites.forEach((s) => {
                    const testCases = s.testCases.filter((tc) => {
                        return tc.type === "error" || tc.type === "failure";
                    });
                    testCases.forEach((tc) => {
                        const line = `${path.basename(tc.file)}:${tc.line}\n    ${tc.name}\n\n`;
                        failures.add(line);
                    });
                });
            });
            failures.size > 0 && pipeline.set("failures", failures);
        }

        let emails = new Set([pipeline.getCommitterEmail()]);
        if (pipeline.getApprovedByEmail()) {
            console.log("Approved by", pipeline.getApprovedByEmail());
            emails.add(pipeline.getApprovedByEmail());
        }

        emails.forEach((email) => this.doNotify(pipeline, email));
    }

    async doNotify(pipeline, email) {
        if (email === "noreply@github.com") {
            console.log(`${email} skipping`);
            return false;
        }

        const userChannel = await this.getChannelByEmail(email);
        if (!userChannel) {
            return;
        }

        console.log(`Notify ${pipeline.getCommitterName()} ${email} ${userChannel}`);

        const notification = await new PipelineFailedNotification(pipeline).toJSON();
        await this.app.client.chat.postMessage({
            token: config.get("slack.token"),
            channel: userChannel,
            ...notification,
        });
    }

    async getChannelByEmail(email) {
        return "U02C4K1BF";
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
