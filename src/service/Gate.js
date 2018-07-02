const WebSocket = require('ws');
const logger = require('../Logger');
const stats = require('../Stats');
const env = require('../Env');
const BasicService = require('./Basic');
const GateServer = require('./GateServer');
const GateClient = require('./GateClient');
// TODO -

const NOOP = () => {};

class Gate extends BasicService {
    async start({ clientRoutesObject = null, serverRoutesObject = null }) {
        const serializer = this._serializeMessage.bind(this);
        const deserializer = this._deserializeMessage.bind(this);
        const clientRouter = this._makeClientRouter(clientRoutesObject);
        const serverRouter = this._makeServerRouter(serverRoutesObject);

        if (clientRoutesObject) {
            this._client = new GateClient(clientRouter, serializer);

            this.addNested(this._client);
            await this._client.start();
        }

        if (serverRoutesObject) {
            const server = new GateServer(serverRouter, deserializer);

            this.addNested(server);
            await server.start();
        }
    }

    async stop() {
        await this.stopNested();
    }

    async sendTo(service, target, data) {
        this._client.sendTo(service, target, data);
    }

    _serializeMessage(data) {
        let result;

        try {
            result = JSON.stringify(data);
        } catch (error) {
            logger.error(`Gate serialization error - ${error}`);
            process.exit(1);
        }

        return result;
    }

    _deserializeMessage(message) {
        let data;

        try {
            data = JSON.parse(message);
        } catch (error) {
            return { error };
        }

        return data;
    }

    _makeServerRouter(config) {
        return (data, socket) => {
            const routes = config.routes;
            const scope = config.scope || null;
            const target = data.target;

            if (routes[target]) {
                routes[target].call(scope, data, socket);
            } else {
                socket.send(
                    this._serializeMessage({ error: 'Route not found' })
                );
            }
        };
    }

    _makeClientRouter(config) {
        return (data, socket) => {
            //
        };
    }
}

module.exports = Gate;
