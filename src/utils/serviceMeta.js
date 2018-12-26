class ServiceMeta {
    constructor() {
        this._store = {};
    }

    get(key) {
        return this._store[key];
    }

    set(key, value) {
        this._store[key] = value;
    }

    merge(data) {
        Object.assign(this._store, data);
    }
}

module.exports = new ServiceMeta();
