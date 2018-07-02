const WebSocket = require('ws');
const logger = require('../Logger');
const stats = require('../Stats');
const env = require('../Env');
// TODO -

const NOOP = () => {};

class Gate {
    constructor() {
        this._connections = [];
        this._server = null;
        this._serverDeadMapping = new Map();
        this._brokenDropperIntervalId = null;
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
        clearInterval(this._brokenDropperIntervalId);

        if (this._server) {
            this._server.close();
        }

        for (let connection of this._connections) {
            connection.terminate();
        }
    }

    async _connectTo(connectionString) {
        logger.info(`Make Gate-client for ${connectionString}`);

        const timer = new Date();
        // TODO -
    }

    async _makeServer() {
        logger.info('Make Gate-server...');

        const timer = new Date();
        const port = env.GATE_SERVER_PORT;

        this._server = new WebSocket.Server({ port });

        this._server.on('connection', this._handleServerConnection.bind(this));
        this._makeBrokenDropper();

        stats.timing('make_gate_server', new Date() - timer);
        logger.info(`Gate-server listening at ${port}`);
    }

    _handleServerConnection(socket, request) {
        const from = this._getRequestAddressLogString(request);

        socket.on('message', message => {
            this._serverDeadMapping.set(socket, false);
            this._handleServerMessage(socket, message);
        });

        socket.on('open', () => {
            logger.log(`Gate-server connection open - ${from}`);
        });

        socket.on('close', () => {
            logger.log(`Gate-server connection close - ${from}`);
        });

        socket.on('pong', () => {
            this._serverDeadMapping.set(socket, false);
        });
    }

    _getRequestAddressLogString(request) {
        const ip = request.connection.remoteAddress;
        const forwardHeader = request.headers['x-forwarded-for'];
        let forward = '';
        let result = ip;

        if (forwardHeader) {
            forward = forwardHeader.split(/\s*,\s*/)[0];
            result += `<= ${forward}`;
        }

        return result;
    }

    _makeBrokenDropper() {
        const map = this._serverDeadMapping;

        this._brokenDropperIntervalId = setInterval(() => {
            for (let socket of this._server.clients) {
                if (map.get(socket) === true) {
                    socket.terminate();
                } else {
                    map.set(socket, true);
                    socket.ping(NOOP);
                }
            }
        }, env.GATE_SERVER_TIMEOUT);
    }

    _handleServerMessage(message) {
        //
    }
}
