import config from "config";
import Model from "./Model.js";
import { trimEnd } from "lodash-es";
import md5 from "md5";
import * as jv from "junit-viewer";
import Go from "../services/go.js";

class Pipeline extends Model {
    static STAGE_FAILED = "Failed";
    static STAGE_CANCELLED = "Cancelled";
    static STAGE_PASSED = "Passed";
    static STAGE_UNKNOWN = "Unknown";

    getUri() {
        return [this.getName(), this.getStageName()].join("/");
    }

    getUrl() {
        return [config.get("go.url"), "go", "pipelines", this.getUri(), "jobs"].join("/");
    }

    getRerunUri() {
        const uri = [this.get("name"), this.get("label"), this.getStageName().trim("/"), "run-failed-jobs"];
        return `/go/api/stages/${uri.join("/")}`;
    }

    getName() {
        return [this.get("name"), this.get("counter")].join("/");
    }

    getStageName() {
        return [this.get("stage.name"), this.get("stage.counter")].join("/");
    }

    getCommitterName() {
        return this.get("build-cause.0.modifications.0.data.committerName");
    }

    getCommitterEmail() {
        return this.get("build-cause.0.modifications.0.data.committerEmail");
    }

    getCommitHash() {
        return this.get("build-cause.0.modifications.0.revision", "").substring(0, 7);
    }

    getApprovedByEmail() {
        const approvedBy = this.get("stage.approved-by");
        return approvedBy.includes("@") ? approvedBy : null;
    }

    getCommitMessage() {
        const subject = this.get("build-cause.0.modifications.0.data.subject", "");
        const lines = subject.split("\n");
        return lines[0] === subject ? subject : `${lines[0]}...`; // Append ellipsis if truncated
    }

    async shouldNotify() {
        const { state, result } = this.get("stage", {});

        if (result === Pipeline.STAGE_UNKNOWN) {
            return false;
        }

        if (this.hasFailed()) {
            return true;
        }

        return this.hasSucceeded();
    }

    hasSucceeded() {
        const { state, result } = this.get("stage", {});
        return state === Pipeline.STAGE_PASSED && result === Pipeline.STAGE_PASSED;
    }

    hasFailed() {
        const { result } = this.get("stage", {});
        return result === Pipeline.STAGE_FAILED || result === Pipeline.STAGE_CANCELLED;
    }

    getFailedJobs() {
        return this.get("stage.jobs", []).filter((job) => {
            return job.result === "Failed";
        });
    }

    getJobUrl(jobName) {
        const base = `/go/tab/build/detail/${this.getName()}/${this.getStageName()}/${jobName}`;
        return config.get("go.url") + base;
    }

    getRepoUrl() {
        const repoUrl = new URL(this.get("build-cause.0.material.git-configuration.url"));
        repoUrl.username = "";
        repoUrl.password = "";
        return trimEnd(repoUrl.toString(), ".git");
    }

    getCommitUrl() {
        return [this.getRepoUrl(), "commit", this.getCommitHash()].join("/");
    }

    getGitHubUser() {
        const repoUrl = new URL(this.getRepoUrl());
        return repoUrl.pathname.split("/")[1];
    }

    getCommitterAvatarUrl() {
        return `https://www.gravatar.com/avatar/${md5(this.getCommitterEmail())}`;
    }

    getTicketNumber() {
        const re = new RegExp(/\b[A-Z0-9]{2,5}-\d{1,5}\b/, "gmi");
        const ticketNumber = this.getCommitMessage().match(re)?.[0];
        if (!ticketNumber) {
            return this.get("name").match(re)?.[0];
        }

        return ticketNumber;
    }

    getTicketUrl() {
        const ticket = this.getTicketNumber();
        return ticket ? [config.get("jira.url"), "browse", ticket].join("/") : null;
    }

    async getJunitJSON() {
        const failures = [{ suites: [] }];
        const failedJobs = this.getFailedJobs();
        if (!this.hasFailed() || failedJobs.length === 0) {
            return failures;
        }

        const promises = [];
        for (let fj of failedJobs) {
            const junitPromise = Go.getJunitFileForJob(this.getName(), this.getStageName(), fj.name);
            promises.push(junitPromise);
        }

        try {
            const allJunits = await Promise.all(promises);
            allJunits.forEach((junit) => {
                if (!junit) {
                    return;
                }
                try {
                    failures.push(jv.parseXML(junit));
                } catch (err) {
                    console.log("Error parsing XML", err.message);
                }
            });
        } catch (err) {
            console.log("Error while fetching junit XML", err.message);
        }

        return failures;
    }
}

export default Pipeline;
