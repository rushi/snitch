import axios from "axios";
import * as cheerio from "cheerio";
import config from "config";

const url = config.get("go.url") + "/go/admin/status_reports/com.thoughtworks.gocd.elastic-agent.ecs/cluster/CI";

export async function getElasticAgentsInfo() {
    const response = await axios.get(url, { auth: { ...config.get("go") } });
    if (response.data) {
        const $ = cheerio.load(response.data);
        const getCount = (name) => {
            return Number($(`div.cluster-properties label:contains('${name}')`).siblings("span").text());
        };

        const runningTasks = getCount("Running tasks");
        const pendingTasks = getCount("Pending tasks");
        const totalTasks = runningTasks + pendingTasks;

        const spot = getCount("Registered linux spot instances");
        const onDemand = getCount("Registered linux on-demand instances");
        const totalInstances = spot + onDemand;

        // Get errors from the page when or if they show up. I don't know the selector for that yet
        const errorMessages = {};
        if ($(`.event.error`).length > 0) {
            errorMessages.header = $(`.event.error .event-header`).text();
            errorMessages.description = $(`.event.error .event-description`).text();
        }

        return {
            tasks: { running: runningTasks, pending: pendingTasks, total: totalTasks },
            instances: { spot, onDemand, total: totalInstances },
            errorMessages,
        };
    } else {
        console.log("Error: HTTP", response.status);
    }

    return {};
}
