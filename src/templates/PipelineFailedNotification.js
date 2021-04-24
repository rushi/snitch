const Pipeline = require("../models/Pipeline");
const Go = require("../services/go");

class PipelineFailedNotification {
    /**
     * @param {Pipeline} pipeline
     */
    constructor(pipeline) {
        this.pipeline = pipeline;
    }

    getColor() {
        if (this.pipeline.get("stage.state") === Pipeline.STAGE_CANCELLED) {
            return "#ffc03d"; // Yellow
        }

        if (this.pipeline.get("stage.state") === Pipeline.STAGE_FAILED) {
            return "#ff5a5a"; // Red
        }

        if (this.pipeline.get("isFullyGreen")) {
            return "#00FF7F";
        }

        if (this.pipeline.get("stage.state") === Pipeline.STAGE_PASSED) {
            return "#27ce70"; // Green
        }

        return "#1352c6"; // Blue
    }

    async toJSON() {
        const { pipeline } = this;

        const fields = [
            {
                title: "Pipeline",
                value: pipeline.getName(),
                short: true,
            },
            {
                title: "Stage",
                value: pipeline.getStageName(),
                short: true,
            },
        ];

        let jiraLink = null;
        if (pipeline.getTicketNumber()) {
            jiraLink = `<${pipeline.getTicketUrl()}|${pipeline.getTicketNumber()}> `;
        }

        const state = this.pipeline.get("stage.state", "").toLowerCase();
        let pretext = `${jiraLink} Pipeline stage ${state}`;
        if (this.pipeline.get("isFullyGreen")) {
            pretext = `:tada: ${jiraLink} Pipeline *${this.pipeline.get("name")}* is *fully green*`;
        }
        pretext += ` <${pipeline.getUrl()}|${pipeline.getUri()}>`;

        const failures = pipeline.get("failures");
        const failedJobs = pipeline.getFailedJobs();
        if (failures && failedJobs.map) {
            let message = failedJobs.map((j) => `<${pipeline.getJobUrl(j.name)}|${j.name}>`).join(", ");
            if (failures.size > 10) {
                message += "\n_Too many failures to list_";
            } else {
                failures.forEach((failure) => {
                    const failureMsg = failure.replace(/^\s*\n/gm, ""); // Trim empty lines
                    message += "```" + failureMsg + "``` ";
                });
            }

            fields.push({
                title: `Failed Jobs (${failedJobs.length})`,
                value: message,
                short: false,
            });
        }

        return {
            attachments: [
                {
                    mrkdwn_in: [/*"text", */ "pretext"],
                    color: this.getColor(),
                    pretext: pretext.trim(),
                    author_name: pipeline.getCommitterName(),
                    author_icon: pipeline.getCommitterAvatarUrl(),
                    title: pipeline.getCommitHash() + " " + pipeline.getCommitMessage(),
                    title_link: pipeline.getCommitUrl(),
                    // text: "",
                    fields,
                    footer: "Status: " + pipeline.get("stage.result"),
                },
            ],
        };
    }
}

module.exports = PipelineFailedNotification;
