const BasicService = require('./Basic');
// TODO -

class GateClient extends BasicService {
    constructor() {
        super();

        this._connections = [];
    }

    async start() {
        for (let connectionString of connectionList) {
            await this._connectTo(connectionString);
        }
    }

    async stop() {
        for (let connection of this._connections) {
            connection.terminate();
        }
    }
}
