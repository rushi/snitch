import config from "config";
import chalk from "chalk";
import { WebClient } from "@slack/web-api";

const web = new WebClient(config.get("slack.token"));

export const notify = async (text, blocks = [], options = {}) => {
    if (!config.get("slack.enabled")) {
        console.log("Skipping slack notification because it has been disabled. The notification text is:");
        console.log(text);
        return;
    }

    try {
        const response = await web.chat.postMessage({
            text,
            blocks,
            channel: config.get("slack.defaultChannel"),
            ...options,
        });
        if (response?.ok) {
            console.log(chalk.dim("Slack message sent"));
        } else {
            console.log("Slack message sent", response?.ok, response?.message.text ?? response);
        }
    } catch (error) {
        console.log("Error sending slack message", chalk.red(error.message));
        console.log(text);
    }
};
