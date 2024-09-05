class AgentUpdatedNotification {
    constructor(agent) {
        this.agent = agent;
    }

    getColor() {
        if (this.agent.agent_state === "LostContact") {
            return "#ff5a5a"; // Yellow
        }

        if (this.agent.agent_state === "Idle" && this.agent.build_state === "Idle") {
            return "#00FF7F"; // Green
        }

        if (this.agent.agent_state === "Building" || this.agent.build_state === "Building") {
            return "#27ce70"; // Another green
        }

        return "#1352c6"; // Blue
    }

    toJSON(text) {
        const { agent } = this;
        const payload = {
            attachments: [
                {
                    mrkdwn_in: ["text", "title", "pretext"],
                    color: this.getColor(),
                    title: text ?? `Something changed with agent: ${agent.host_name}`,
                    text: `Agent State: ${agent.agent_state} Build State: ${agent.build_state}`,
                    title_link: `https://sage.ci.xola.com/go/agents/${agent.uuid}/job_run_history`,
                    footer: `Agent UUID: ${agent.uuid}`,
                },
            ],
        };

        return payload;
    }
}

export default AgentUpdatedNotification;
