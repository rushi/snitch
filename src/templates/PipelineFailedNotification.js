const Pipeline = require("../models/Pipeline");

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

        if (this.pipeline.get("stage.state") === Pipeline.STAGE_PASSED) {
            return "#27ce70"; // Green
        }

        return "#1352c6"; // Blue
    }

    toJSON() {
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

        if (pipeline.getTicketNumber()) {
            fields.push({
                title: "JIRA",
                value: `<${pipeline.getTicketUrl()}|${pipeline.getTicketNumber()}>`,
                short: true,
            });
        }

        const state = this.pipeline.get("stage.state", "").toLowerCase();

        return {
            attachments: [
                {
                    mrkdwn_in: [/*"text", */ "pretext"],
                    color: this.getColor(),
                    pretext: `Pipeline stage ${state} <${pipeline.getUrl()}|${pipeline.getUri()}>`,
                    author_name: pipeline.getCommitterName(),
                    author_icon: pipeline.getCommitterAvatarUrl(),
                    title: pipeline.getCommitHash() + " " + pipeline.getCommitMessage(),
                    title_link: pipeline.getCommitUrl(),
                    // text: "",
                    fields,
                    footer: "Status: " + pipeline.get("stage.result"),

                    callback_id: "wtf",
                    actions: [
                        {
                            name: "game",
                            text: "Rerun Failed Jobs",
                            type: "button",
                            value: "chess",
                        },
                    ],
                },
            ],
        };
    }
}

module.exports = PipelineFailedNotification;
