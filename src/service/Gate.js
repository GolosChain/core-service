const jayson = require('jayson');
const env = require('../Env');
const BasicService = require('./Basic');

class Gate extends BasicService {
    constructor() {
        super();

        this._server = null;
        this._clientsMap = new Map();
    }

    async start({ serverRoutes, requiredClients }) {
        if (serverRoutes) {
            await this._startServer(serverRoutes);
        }

        if (requiredClients) {
            this._makeClients(requiredClients);
        }
    }

    stop() {
        this._server.close();
    }

    sendTo(service, method, data) {
        return new Promise((resolve, reject) => {
            this._clientsMap
                .get(service)
                .request(method, data, (error, response) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(response);
                    }
                });
        });
    }

    _startServer(rawRoutes) {
        const routes = this._normalizeRoutes(rawRoutes);

        return new Promise((resolve, reject) => {
            this._server = jayson.server(routes).http();

            this._server.listen(env.GATE_LISTEN_PORT, error => {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        });
    }

    _makeClients(requiredClients) {
        for (let alias of Object.keys(requiredClients)) {
            const connectString = requiredClients[alias];
            const client = new jayson.client.http(connectString);

            this._clientsMap.set(alias, client);
        }
    }

    _normalizeRoutes(routes) {
        for (let route of Object.keys(routes)) {
            let originHandler = routes[route];

            routes[route] = (data, callback) => {
                originHandler.call(null, data).then(
                    data => {
                        callback(null, data);
                    },
                    error => {
                        callback(error, null);
                    }
                );
            };
        }
    }
}

module.exports = Gate;
