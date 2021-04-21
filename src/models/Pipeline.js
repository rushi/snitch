const config = require("config");
const Model = require("./Model");
const _ = require("lodash");
const Go = require("../services/go");
const md5 = require("md5");

class Pipeline extends Model {
    static STAGE_FAILED = "Failed";
    static STAGE_CANCELLED = "Cancelled";
    static STAGE_PASSED = "Passed";

    getUri() {
        return [this.getName(), this.getStageName()].join("/");
    }

    getUrl() {
        return [config.get("go.url"), "go", "pipelines", this.getUri(), "jobs"].join("/");
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

    getCommitMessage() {
        const subject = this.get("build-cause.0.modifications.0.data.subject", "");
        const lines = subject.split("\n");
        return lines[0] === subject ? subject : lines[0] + "..."; // Append ellipsis if truncated
    }

    shouldNotify() {
        const { state, result } = this.get("stage", {});

        // Implement more conditions here
        
        if (!config.get('includeMergeCommits') && this.getCommitMessage().match(/merge branch/i)) {
            console.log("This is a merge commit, skipping it\n", this.getCommitterName(), this.getCommitMessage());
            return false;
        }

        if (
            (state === Pipeline.STAGE_FAILED && result === Pipeline.STAGE_FAILED) ||
            (state === Pipeline.STAGE_CANCELLED && result === Pipeline.STAGE_CANCELLED)
        ) {
            return true;
        }

        if (state === Pipeline.STAGE_PASSED && result === Pipeline.STAGE_PASSED) {
            return Go.isPipelinePassed(this.getName());
        }

        return false;
    }

    getFailedJob() {
        return this.get("stage.jobs", []).find((job) => {
            return job.result === "Failed";
        });
    }

    getRepoUrl() {
        const repoUrl = new URL(this.get("build-cause.0.material.git-configuration.url"));
        repoUrl.username = "";
        repoUrl.password = "";
        return _.trimEnd(repoUrl.toString(), ".git");
    }

    getCommitUrl() {
        return [this.getRepoUrl(), "commit", this.getCommitHash()].join("/");
    }

    getGitHubUser() {
        const repoUrl = new URL(this.getRepoUrl());
        return repoUrl.pathname.split("/")[1];
    }

    getCommitterAvatarUrl() {
        return [`https://www.gravatar.com/avatar/${this.getCommitterEmail()}`];
    }

    getTicketNumber() {
        return this.getCommitMessage().match(/\b[A-Z]{2,3}-\d{1,5}\b/)?.[0];
    }

    getTicketUrl() {
        const ticket = this.getTicketNumber();
        return ticket ? [config.get("jira.url"), "browse", ticket].join("/") : null;
    }
}

module.exports = Pipeline;
