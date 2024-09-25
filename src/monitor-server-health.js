import chalk from "chalk";
import dayjs from "dayjs";
import { CronJob } from "cron";
import Go from "./services/go.js";

const now = () => dayjs().format("HH:mm:ss");
const messagesToSkip = [
    /Modification check failed/
];

async function check() {
    const data = await Go.fetchServerHealth();
    if (!data.length) {
        process.stdout.write(".");
        return;
    }

    if (data.length > 0) {
        console.log(`${now()} Found ${data.length} warnings`);
    }
    const spacer = " ".repeat(now().length);

    let counter = 0;
    data.forEach((info) => {
        const re = new RegExp(/\b[A-Z0-9]{2,5}-\d{1,5}\b/, "gmi");
        const ticketNumber = chalk.bold(info.message.match(re)?.[0]);

        for (const re of messagesToSkip) {
            if (re.test(info.message)) {
                console.log(spacer, `${++counter} Skipped ${ticketNumber}`)
                return;
            }
        }

        const duration = info.detail.match(/not been assigned an agent in the last ([0-9]+) minute/);
        const pipelineName = info.message.match(/Job '(.*)' is not responding/);

        const level = /error|warn/i.test(info.level) ? "red" : "bold";
        console.log(spacer, chalk[level](`${++counter} ${info.level}`), info.message);
        if (pipelineName && duration && duration[1]) {
            console.log(spacer, `Pipeline ${chalk.bold(pipelineName[1])} waiting for ${chalk.red(duration[1])} minutes`);
        } else {
            console.log(spacer, chalk.dim(info.detail));
        }
    })

    console.log();
}

if (process.argv[2] === "start") {
    const expr = "*/1 * * * 1-5"; // */1 is every minute (see crontab.guru)
    console.log(`${now()} 🚀 Starting Cron Job for server health (${expr})`);
    check();
    const job = new CronJob(expr, check);
    job.start();
} else {
    check();
}
