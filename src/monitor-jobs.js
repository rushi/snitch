import chalk from "chalk";
import { CronJob } from "cron";
import dayjs from "dayjs";
import Go from "./services/go.js";
import { notify } from "./services/slack.js";

const now = () => dayjs().format("HH:mm:ss");
const messagesToSkip = [/Modification check failed/];

async function check() {
    const data = await Go.fetchServerHealth();
    if (!data.length) {
        process.stdout.write(".");
        return;
    }

    if (data.length > 1) {
        console.log(`${now()} Found ${data.length} warnings`);
    }
    const spacer = " ".repeat(now().length);

    let counter = 0;
    const pipelinesProcessed = [];

    const NOTIFY_MAX_MINUTES = 6;
    const pipelineMap = {};

    data.forEach((info) => {
        const re = new RegExp(/\b[A-Z0-9]{2,5}-\d{1,5}\b/, "gmi");
        const branchRe = new RegExp(/\bBranch: (.*$)\b/, "gmi");
        const ticketNumber = info.message.match(re)?.[0] ?? info.message.match(branchRe)?.[0];

        for (const re of messagesToSkip) {
            if (re.test(info.message)) {
                console.log(spacer, `${++counter} Skipped ${ticketNumber}`);
                if (!ticketNumber) {
                    console.log(spacer, info.message, info.detail);
                }
                return;
            }
        }

        const duration = info.detail.match(/in the last ([0-9]+) minute/);
        const pipelineMatch = info.message.match(/Job '(.*)' is not responding/);
        // console.log(spacer, `${++counter} ${info.level}`, info.message);
        if (pipelineMatch && duration && duration[1]) {
            const minutes = Number(duration[1]);
            if (minutes > NOTIFY_MAX_MINUTES) {
                const name = pipelineMatch[1].split("/")?.[0] ?? pipelineMatch[1];
                if (!pipelineMap[name]) {
                    console.log(spacer, `${ticketNumber} Pipeline ${name} waiting for ${chalk.red(minutes)} minutes`);
                    pipelineMap[name] = { name, minutes, count: 0, pipelines: [] }
                }
                pipelineMap[name].count += 1;
                pipelineMap[name].pipelines.push(pipelineMatch[1]);
                pipelinesProcessed.push(name);
                ticketNumber && pipelinesProcessed.push(ticketNumber);
            }
        } else {
            console.log(spacer, chalk.dim(info.detail));
        }
    });

    let message = "";
    let totalJobs = 0;
    const totalPipelines = Object.keys(pipelineMap).length;
    for (const pipeline in pipelineMap) {
        const { name, count, minutes } = pipelineMap[pipeline];
        message += `${count} x ${name} waiting for *${minutes} minutes*\n`;
        totalJobs += count;
    }
    if (totalPipelines > 0) {
        await notify(`${now()} :gocd-cancel: *${totalJobs} affected jobs across ${totalPipelines} pipelines*\n\n${message}`);
    }
    console.log();
}

if (process.argv[2] === "start") {
    const interval = process.argv[3] ?? 5;
    const expr = `*/${interval} * * * 1-5`; // */2 is every two minutes (see crontab.guru)
    console.log(`${now()} 🚀 Starting Cron Job for server health (${expr})`);
    check();
    const job = new CronJob(expr, check);
    job.start();
} else {
    check();
}
