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
                const testCases = suites.filter((s) => {
                    return s.testCases.filter((tc) => tc.type === "error" || tc.type === "failure");
                });
                testCases.flat().forEach((tc) => {
                    if (tc.file) {
                        failures.add(`${path.basename(tc.file)}:${tc.line}\n    ${tc.name}\n\n`);
                    } else {
                        failures.add(`${tc.classname}`);
                    }
                });
            });
            failures.size > 0 && pipeline.set("failures", failures);
        }

        let emails = new Set([pipeline.getCommitterEmail()]);
        if (pipeline.getApprovedByEmail()) {
            emails.add(pipeline.getApprovedByEmail());
        }

        emails.forEach((email) => this.doNotify(pipeline, email));
    }

    async doNotify(pipeline, email) {
        if (email === "noreply@github.com") {
            console.log(`${email} skipping`);
            return false;
        }

        let user = await this.getChannelByEmail(email);
        if (!user) {
            return;
        }

        user.id = "U02C4K1BF"; // To debug. Rushi's ID
        console.log(`Notify ${pipeline.getCommitterName()} ${email} ${JSON.stringify(user)}`);

        const notification = await new PipelineFailedNotification(pipeline, user).toJSON();
        await this.app.client.chat.postMessage({
            token: config.get("slack.token"),
            channel: user.id,
            ...notification,
        });
    }

    async getChannelByEmail(email) {
        try {
            const result = await this.app.client.users.lookupByEmail({
                token: config.get("slack.token"),
                email,
            });
            if (result) {
                return { id: result.user?.id, name: result.user?.real_name, avatar: result.user?.profile?.image_192 };
            }
        } catch (err) {
            console.log("Error finding user", err.message);
        }

        return null;
    }
}

module.exports = PipelineUpdateHandler;
