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
    const pipelineNotifyMessages = [];

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
        const pipelineName = info.message.match(/Job '(.*)' is not responding/);
        if (pipelinesProcessed.includes(pipelineName) || pipelinesProcessed.includes(ticketNumber)) {
            counter++;
            return;
        }

        console.log(spacer, `${++counter} ${info.level}`, info.message);
        if (pipelineName && duration && duration[1]) {
            const minutes = Number(duration[1]);
            const name = pipelineName[1].split("/")?.[0] ?? pipelineName[1];
            console.log(spacer, `${ticketNumber} Pipeline ${name} waiting for ${chalk.red(minutes)} minutes`);
            pipelinesProcessed.push(pipelineName);
            ticketNumber && pipelinesProcessed.push(ticketNumber);
            const message = `Pipeline *${name}* waiting for *${minutes}* minutes`;
            if (minutes > NOTIFY_MAX_MINUTES && !pipelineNotifyMessages.includes(message)) {
                pipelineNotifyMessages.push(message);
            }
        } else {
            console.log(spacer, chalk.dim(info.detail));
        }
    });

    if (pipelineNotifyMessages.length > 0) {
        await notify(`:gocd-cancel: ${now()} ${pipelineNotifyMessages.length} affected pipelines\n` + pipelineNotifyMessages.join("\n"));
    }
    console.log();
}

if (process.argv[2] === "start") {
    const expr = "*/5 * * * 1-5"; // */2 is every two minutes (see crontab.guru)
    console.log(`${now()} 🚀 Starting Cron Job for server health (${expr})`);
    check();
    const job = new CronJob(expr, check);
    job.start();
} else {
    check();
}
