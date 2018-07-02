const logger = require('../Logger');
const stats = require('../Stats');
const env = require('../Env');
const BasicService = require('./Basic');
const GateUtils = require('../GateUtils');

class GateClient extends BasicService {
    constructor(address) {
        super();

        this._address = address;
    }

    async start() {
        // TODO -
    }

    async stop() {
        // TODO -
    }

    async send(target, data) {
        // TODO -
    }

    async describe(target, data, callback) {
        // TODO -
    }
}
