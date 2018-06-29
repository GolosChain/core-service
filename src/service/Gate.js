const WebSocket = require('ws');
const logger = require('../Logger');
const stats = require('../Stats');
const env = require('../Env');
// TODO -

class Gate {
    constructor() {
        this._connections = [];
        this._server = null;
    }

    async start(connectionList, makeServer) {
        for (let connectionString of connectionList) {
            await this._connectTo(connectionString);
        }

        if (makeServer) {
            await this._makeServer();
        }
    }

    async stop() {
        if (this._server) {
            this._server.close();
        }

        for (let connection of this._connections) {
            connection.terminate();
        }
    }

    async _connectTo(connectionString) {
        logger.log(`Make Gate client for ${connectionString}`);

        const timer = new Date();
        // TODO -
    }

    async _makeServer() {
        logger.log('Make Gate server...');

        const timer = new Date();
        // TODO -
    }
}
