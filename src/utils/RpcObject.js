const jayson = require('jayson');

class RpcObject {
    static request(method, data, id) {
        jayson.utils.request(method, data, id);
    }

    static response(error, result, id) {
        jayson.utils.response(error, result, id);
    }

    static error(code, message) {
        const error = jayson.server.prototype.error(code, message);

        return this.response(error);
    }
}

module.exports = RpcObject;
