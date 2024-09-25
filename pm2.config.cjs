module.exports = {
    apps: [
        {
            name: "Snitch Web",
            script: "node src/index.js"
        },
        {
            name: "Monitor Jobs",
            script: "node src/monitor-jobs.js start"
        },
        {
            name: "Monitor Agents",
            script: "node src/monitor-elastic-agents.js start"
        }
    ]
};
