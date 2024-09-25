import _ from "lodash-es";
import chalk from "chalk";
import dayjs from "dayjs";
import config from "config";
import axios from "axios";
import * as cheerio from "cheerio";
import { CronJob } from "cron";
import { notify } from "./services/slack.js";

const now = () => dayjs().format("HH:mm:ss");
const url = config.get("go.url") + "/go/admin/status_reports/com.thoughtworks.gocd.elastic-agent.ecs/cluster/CI";

const MAX_PENDING_TASKS = 15;
const MAX_HOST_MACHINES = 40;

async function check() {
    const response = await axios.get(url, { auth: { ...config.get("go") } });
    if (response.data) {
        const $ = cheerio.load(response.data);
        const getCount = (name) => {
            return Number($(`div.cluster-properties label:contains('${name}')`).siblings("span").text());
        };

        console.log(`GoCD Elastic Agent Status at ${now()}`);

        process.stdout.write(chalk.bold("    Tasks "));
        const runningTasks = getCount("Running tasks");
        const pendingTasks = getCount("Pending tasks");
        const totalTasks = runningTasks + pendingTasks;
        console.log(`Running: ${runningTasks}   Pending: ${pendingTasks}`, chalk.bold(` Total: ${totalTasks}`));
        if (Number(pendingTasks) >= MAX_PENDING_TASKS) {
            console.log("    ", chalk.bgRed.white.bold(`Too many pending tasks (${pendingTasks})`));
            await notify(`🚨 Too many pending tasks: ${pendingTasks} Running: ${runningTasks}`);
        }

        process.stdout.write(chalk.bold("Instances "));
        const spot = getCount("Registered linux spot instances");
        const onDemand = getCount("Registered linux on-demand instances");
        const total = spot + onDemand;
        console.log(`   Spot: ${spot} On Demand: ${onDemand}`, chalk.bold(`  Total: ${total}`));
        if (total >= MAX_HOST_MACHINES) {
            console.log("    ", chalk.bgGreen.white.bold(`Max limit reached: ${total}/${MAX_HOST_MACHINES}`));
            await notify(`🚨 Max limit of host machines reached: ${total}/${MAX_HOST_MACHINES}`);
        }

        // TODO: Get errors from the page when or if they show up. I don't know the selector for that yet
        // Guess based on https://github.com/gocd/gocd-ecs-elastic-agent/blob/master/src/main/resources/error.template.ftlh#L45
        if ($(`.event.error`).length > 0) {
            const header = $(`.event.error .event-header`).text();
            const description = $(`.event.error .event-description`).text();
            console.log(header);
            console.log(chalk.red(description));
            console.log();
            await notify(`🚨 ${header}\n${description}`);
        }
    } else {
        console.log(response.status);
    }
    console.log();
}

if (process.argv[2] === "start") {
    const expr = "*/2 * * * 1-5"; // */2 is every two minutes
    console.log(`${now()} 🚀 Starting Cron Job for agents health (${expr})`);
    check();
    const job = new CronJob(expr, check);
    job.start();
} else {
    check();
}
