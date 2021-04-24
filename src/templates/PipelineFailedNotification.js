const Pipeline = require("../models/Pipeline");
const Go = require("../services/go");

class PipelineFailedNotification {
    /**
     * @param {Pipeline} pipeline
     */
    constructor(pipeline, user) {
        this.pipeline = pipeline;
        this.user = user;
    }

    getColor() {
        if (this.pipeline.get("stage.state") === Pipeline.STAGE_CANCELLED) {
            return "#ffc03d"; // Yellow
        }

        if (this.pipeline.get("stage.state") === Pipeline.STAGE_FAILED) {
            return "#ff5a5a"; // Red
        }

        if (this.pipeline.get("isFullyGreen")) {
            return "#00FF7F"; // Green
        }

        if (this.pipeline.get("stage.state") === Pipeline.STAGE_PASSED) {
            return "#27ce70"; // Another Green
        }

        return "#1352c6"; // Blue
    }

    async toJSON() {
        const { pipeline } = this;

        const fields = [];

        // Jira link and emails that committed and trigerred the build
        const jira = pipeline.getTicketNumber() ? `<${pipeline.getTicketUrl()}|${pipeline.getTicketNumber()}>` : null;

        // Special message if the build is fully green
        const state = this.pipeline.get("stage.state", "").toLowerCase();
        let pretext = `${jira} Pipeline stage *${state}*`;
        if (this.pipeline.get("isFullyGreen")) {
            pretext = `:partyparrot: ${jira} Pipeline *${this.pipeline.get("name")}* is *fully green*`;
        }
        pretext += ` <${pipeline.getUrl()}|${pipeline.getUri()}>`;

        // Create an empty line
        const emptyLine = { title: ``, value: "", short: true };
        fields.push(emptyLine, emptyLine);

        const failures = pipeline.get("failures");
        const failedJobs = pipeline.getFailedJobs();
        if (failedJobs.length > 0) {
            const limit = 10;
            let message = failedJobs
                .slice(0, limit)
                .map((j) => `<${pipeline.getJobUrl(j.name)}|${j.name}>`)
                .join(", ");

            if (failedJobs.length > 10) {
                message += ` and *${failedJobs.length - 10}* more jobs :scream:`;
            } else {
                failures?.forEach((failure) => {
                    const failureMsg = failure.replace(/^\s*\n/gm, ""); // Trim empty lines
                    message += "```" + failureMsg + "``` ";
                });
            }

            fields.push({ title: `Failed Jobs (${failedJobs.length})`, value: message });
        }

        const emails = [`Commited By: ${pipeline.getCommitterEmail()}`];
        if (pipeline.getApprovedByEmail() !== pipeline.getCommitterEmail()) {
            emails.push(`Trigerred by: ${pipeline.getApprovedByEmail()}`);
        }

        return {
            attachments: [
                {
                    mrkdwn_in: ["text", "pretext"],
                    color: this.getColor(),
                    pretext: pretext.trim(),
                    author_name: this.user.name,
                    author_icon: this.user.avatar,
                    title: `${pipeline.getCommitHash()} ${pipeline.getCommitMessage()}`,
                    title_link: pipeline.getCommitUrl(),
                    text: emails.join(" "),
                    fields,
                    footer:
                        "Status: " + (this.pipeline.get("isFullyGreen") ? "Completed" : pipeline.get("stage.result")),
                },
            ],
        };
    }
}

module.exports = PipelineFailedNotification;
