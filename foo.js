const Pipeline = require("./src/models/Pipeline");
const webhook = require("./webhook.json");

console.log(new Pipeline(webhook.pipeline).getCommitterAvatarUrl());
