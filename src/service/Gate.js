const logger = require('../Logger');
const BasicService = require('./Basic');
const GateServer = require('./GateServer');
const GateClient = require('./GateClient');

class Gate extends BasicService {
    async start({ serverRoutes = null, requiredServices = [] }) {
        await this._initServer(serverRoutes);
        await this._initClients(requiredServices);
    }

    async stop() {
        await this.stopNested();
    }

    async sendTo(service, target, data) {
        this._client.sendTo(service, target, data);
    }

    async _initServer(routesConfig) {
        if (!routesConfig) {
            return;
        }

        this._server = new GateServer(routesConfig);

        this.addNested(this._server);
        await this._server.start();
    }

    async _initClients(servicesList) {
        if (!servicesList.length) {
            return;
        }

        let mapping = await this._getServicesAddressMapping();

        for (let serviceName of servicesList) {
            const address = mapping[serviceName];

            if (!address) {
                logger.log(`Gate - invalid service name - ${serviceName}`);
                process.exit(1);
            }

            this._client = new GateClient(address);

            this.addNested(this._client);
            await this._client.start();
        }
    }

    async _getServicesAddressMapping() {
        const timer = new Date();
        // TODO -
    }
}

module.exports = Gate;
