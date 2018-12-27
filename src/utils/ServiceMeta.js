class ServiceMeta {
    static get(key) {
        return this._store[key];
    }

    static set(key, value) {
        this._store[key] = value;
    }
}

ServiceMeta._store = {};

module.exports = ServiceMeta;
