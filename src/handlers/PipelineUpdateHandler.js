import { basename } from "path";
import Pipeline from "../models/Pipeline.js";
import PipelineFailedNotification from "../templates/PipelineFailedNotification.js";
import config from "config";
import Handler from "./Handler.js";
import Go from "../services/go.js";
import { isEmpty } from "lodash-es";

class PipelineUpdateHandler extends Handler {
    static shouldHandle(request) {
        return !!request.body?.pipeline;
    }

    async parseFailures(pipeline, detail = false) {
        const failedJobs = pipeline.getFailedJobs();
        if (failedJobs.length === 0 || failedJobs.length > 10) {
            console.log(`Not enough or Too many failures, not going to get failures Count: ${failedJobs.length}`);
            return;
        }

        const failures = new Set();
        const junitJobs = await pipeline.getJunitJSON();
        junitJobs.forEach((junit) => {
            const testCaseList = junit.suites.map((suite) => {
                const hasErrors = suite.errors > 0 || suite.failures > 0 || suite.type === "failure";
                return hasErrors ? suite.testCases.filter((tc) => tc.type === "error" || tc.type === "failure") : [];
            });

            testCaseList.forEach((testCases) => {
                testCases.forEach((tc) => {
                    let line;
                    if (tc.file) {
                        line = `${basename(tc.file)} Line: ${tc.line}\n`;
                        if (detail) {
                            line = this.processTestCaseMessages(tc.messages, line);
                        } else {
                            line += `\n    ${tc.name}`;
                        }
                        line += "\n";
                    } else if (tc.className) {
                        line = `${tc.classname}`;
                    } else if (tc.messages) {
                        line = this.processTestCaseMessages(tc.messages, line);
                    }

                    line && failures.add(line);
                });
            });
        });

        if (failures.size > 0) {
            console.log("parsed failures", failures.size, failures);
        }
        failures.size > 0 && pipeline.set("failures", failures);
    }

    hasPreviousBuildFailed(pipeline, stageHistory) {
        const pipelineCounter = pipeline.get("counter");
        const stageName = pipeline.get("stage.name");
        const stageCounter = pipeline.get("stage.counter");

        const previousBuild = stageHistory.stages.find((s) => {
            return s.pipeline_counter == pipelineCounter && s.name === stageName && s.counter == stageCounter - 1;
        });

        return previousBuild && previousBuild.result === Pipeline.STAGE_PASSED;
    }

    processTestCaseMessages(messages, line) {
        messages.values.forEach((m) => {
            const lines = m.value.split("\n").slice(0, 5);
            lines.forEach((l) => (line += `${" ".repeat(4) + l}\n`));
        });
        return line;
    }

    async handle(request) {
        const pipeline = new Pipeline(request.body.pipeline);

        if (!(await pipeline.shouldNotify())) {
            return;
        }

        const name = pipeline.getName();
        if (pipeline.hasSucceeded()) {
            const isFullyGreen = await Go.isEntirePipelineGreen(pipeline.getName());
            if (isFullyGreen) {
                pipeline.set("isFullyGreen", isFullyGreen);
            } else {
                const stageHistory = await Go.fetchStageHistory(pipeline.get("name"), pipeline.get("stage.name"));
                const hasPreviousBuildSucceeded = this.hasPreviousBuildFailed(pipeline, stageHistory);
                if (hasPreviousBuildSucceeded) {
                    // Previous build succeeded, we don't need to notify again
                    return;
                }
            }
        } else {
            await this.parseFailures(pipeline);
        }

        const approvedEmail = pipeline.getApprovedByEmail();
        const committerEmail = pipeline.getCommitterEmail();
        console.log(`Pipeline: ${name} ${pipeline.getCommitterName()} ${committerEmail} and ${approvedEmail}`);

        const emails = new Set();
        if (committerEmail) {
            emails.add(committerEmail);
        }
        if (approvedEmail) {
            emails.add(approvedEmail);
        }

        emails.forEach((email) => this.doNotify(pipeline, email));
    }

    async doNotify(pipeline, email) {
        if (email === "noreply@github.com" || isEmpty(email)) {
            console.log(`'${email}' skipping for ${pipeline.getUrl()} ${pipeline.getCommitHash()}`);
            return false;
        }

        const user = await this.getChannelByEmail(email);
        if (!user) {
            return;
        }

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
            console.log(`Error finding user by email: '${email}'`);
            console.log(err.message);
        }

        return null;
    }
}

export default PipelineUpdateHandler;
