const _ = require("lodash");

class Model {
    constructor(attributes) {
        this.attributes = attributes;
    }

    get(path, defaultValue) {
        return _.get(this.attributes, path, defaultValue);
    }

    getModel(path, type = Model) {
        return this.get(path) || new type();
    }

    set(path, value) {
        _.set(this.attributes, path, value);
        return this;
    }

    toJSON() {
        return this.attributes;
    }
}

module.exports = Model;
