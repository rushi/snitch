const Handler = require("./Handler");
const _ = require("lodash");
const chalk = require("chalk");
const dayjs = require("dayjs");
const util = require("util");

class AgentHandler extends Handler {
    static shouldHandle(request) {
        const body = request.body ?? {};
        return !!(body.agent_state && body.agent_config_state);
    }

    async handle(request) {
        const body = _.omit(request.body, ["operating_system"]);
        const isElastic = body.is_elastic;
        const isDeployAgent = !isElastic && !body.host_name.includes("i-") && !body.host_name.startsWith("ip-");

        const { host_name, agent_config_state, agent_state, build_state } = body;
        const now = dayjs().format("YYYY-MM-DD HH:mm");
        if (!isDeployAgent) {
            return;
        }

        const agentName = isElastic ? host_name : chalk.green(host_name);
        const configState = agent_config_state === "Disabled" ? chalk.bold(agent_config_state) : agent_config_state;
        const agentState = agent_state === "LostContact" ? chalk.bold(agent_state) : agent_state;
        const buildState = build_state === "Unknown" ? chalk.bold(build_state) : build_state;

        if (isDeployAgent) {
            if (agent_state === "LostContact") {
                AgentHandler.log(body);
                console.log(chalk.bgRed.white(`[${now}] Deployment Agent lost contact`));
            } else if (agent_state === "Idle" && build_state === "Idle") {
                AgentHandler.log(body);
                console.log(chalk.bgGreen.white(`[${now}] Deployment Agent came online?`));
            }
        }

        console.log(`[${now}] ${agentName} Status: ${configState} State: ${agentState} • Build State: ${buildState}`);
        if (isDeployAgent) {
            console.log(" ".repeat(18), `https://sage.ci.xola.com/go/agents/${body.uuid}/job_run_history`);
        }
    }

    static log(data, options = {}) {
        console.log(
            util.inspect(data, {
                colors: true,
                sorted: true,
                breakLength: 1000,
                depth: null,
                compact: true,
                ...options,
            }),
        );
    }
}

module.exports = AgentHandler;
