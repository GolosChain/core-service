const WebSocket = require('ws');
const logger = require('../Logger');
const stats = require('../Stats');
const env = require('../Env');
const BasicService = require('./Basic');
const GateUtils = require('../GateUtils');

class GateClient extends BasicService {
    constructor(address) {
        super();

        this._address = address;
        this._alive = false;
    }

    async start() {
        this._socket = new WebSocket(this._address);

        this._socket.on('open', () => {
            this._alive = true;
            logger.log(
                `Gate client connection established for - ${this._address}`
            );
        });

        this._socket.on('close', () => {
            this._alive = false;
            logger.log(`Gate client connection closed for - ${this._address}`);
        });

        this._socket.on('message', data => {
            this._alive = true;
            // TODO -
        });

        this._socket.on('error', error => {
            // TODO -
        })
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
