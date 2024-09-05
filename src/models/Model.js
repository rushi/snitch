import { get as _get, set as _set } from "lodash-es";

class Model {
    constructor(attributes) {
        this.attributes = attributes;
    }

    get(path, defaultValue) {
        return _get(this.attributes, path, defaultValue);
    }

    getModel(path, type = Model) {
        return this.get(path) || new type();
    }

    set(path, value) {
        _set(this.attributes, path, value);
        return this;
    }

    toJSON() {
        return this.attributes;
    }
}

export default Model;
