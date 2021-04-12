const axios = require("axios");
const config = require("config");

const api = axios.create({
    baseURL: config.get("go.url"),
    auth: { username: config.get("go.username"), password: config.get("go.password") },
});

const Go = {
    runFailedJobs(uri) {
        return api.post(
            `/go/api/stages/${uri}/run-failed-jobs`,
            {},
            {
                headers: {
                    "X-GoCD-Confirm": "true",
                    Accept: "application/vnd.go.cd.v2+json",
                },
            },
        );
    },

    async isPipelinePassed(pipeline) {
        const { data } = await api.get(`/go/api/pipelines/${pipeline}`, {
            headers: {
                Accept: "application/vnd.go.cd.v1+json",
            },
        });

        return data.stages.every((stage) => {
            return stage.result === "Passed";
        });
    },
};

module.exports = Go;
