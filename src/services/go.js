import axios from "axios";
import config from "config";

const api = axios.create({
    baseURL: config.get("go.url"),
    auth: { username: config.get("go.username"), password: config.get("go.password") },
});

const Go = {
    async runFailedJobs(uri) {
        const headers = { headers: { "X-GoCD-Confirm": "true", Accept: "application/vnd.go.cd.v3+json" } };
        try {
            const { data } = await api.post(uri, {}, headers);
            console.log("Rerun response", data);
            return data;
        } catch (err) {
            console.log("Error re-triggering", err.message);
            return { message: err.message };
        }
    },

    async getJunitFileForJob(name, stage, jobName) {
        const url = `/go/files/${name}/${stage}/${jobName}.json`;
        const headers = { headers: { Accept: "application/vnd.go.cd.v1+json" } };
        console.log(`Fetching artifacts for ${jobName}`, url);

        const resp = api.get(url, headers);
        return resp.then((r) => {
            const artifactNames = config.get("go.jobs.artifactName");
            const junitFilenames = config.get("go.jobs.junitXmlFileName");
            const testOutput = r.data.find((t) => artifactNames.includes(t.name));
            if (testOutput?.files) {
                const file = testOutput.files.find((f) => junitFilenames.includes(f.name));
                if (file) {
                    return api.get(file.url, headers).then((xml) => xml.data);
                }
            } else {
                console.log("Weird, no data for", jobName);
            }
        });
    },

    async fetchStageHistory(pipeline, stage) {
        const url = `/go/api/stages/${pipeline}/${stage}/history?page_size=50`;
        const headers = { headers: { "X-GoCD-Confirm": "true", Accept: "application/vnd.go.cd.v3+json" } };
        try {
            const { data } = await api.get(url, headers);
            return data;
        } catch (err) {
            console.log("Error fetching stage history", err.message);
        }
        return null;
    },

    async fetchPipelineInstance(pipeline) {
        const url = `/go/api/pipelines/${pipeline}`;
        try {
            const { data } = await api.get(url, {
                headers: {
                    Accept: "application/vnd.go.cd.v1+json",
                },
            });
            return data;
        } catch (err) {
            console.log(`Error fetching pipeline ${url}`, err.message);
            return [];
        }
    },

    async isEntirePipelineGreen(pipeline) {
        const data = await this.fetchPipelineInstance(pipeline);
        if (!data) {
            return null;
        }

        return data.stages?.every((stage) => stage.result === "Passed");
    },
};

export default Go;
