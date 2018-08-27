module.exports = {
    // Backward capability
    Logger: require('./src/utils/Logger'),
    Moments: require('./src/utils/Moments'),
    Template: require('./src/utils/Template'),
    HttpError: require('./src/httpError'),
    service: {
        Basic: require('./src/services/Basic'),
        BlockSubscribe: require('./src/services/BlockSubscribe'),
        BlockSubscribeRestore: require('./src/services/BlockSubscribeRestore'),
        MongoDB: require('./src/services/MongoDB'),
        Gate: require('./src/services/Gate'),
    },

    Stats: require('./src/Stats'),
    statsClient: require('./src/Stats').client,
    httpError: require('./src/httpError'),
    defaultStarter: require('./src/defaultStarter'),
    services: {
        Basic: require('./src/services/Basic'),
        BlockSubscribe: require('./src/services/BlockSubscribe'),
        BlockSubscribeRestore: require('./src/services/BlockSubscribeRestore'),
        MongoDB: require('./src/services/MongoDB'),
        Gate: require('./src/services/Gate'),
    },
    utils: {
        BlockChainValues: require('./src/utils/BlockChainValues'),
        Logger: require('./src/utils/Logger'),
        Moments: require('./src/utils/Moments'),
        Template: require('./src/utils/Template'),
    },
};
