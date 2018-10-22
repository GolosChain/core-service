module.exports = {
    services: {
        Basic: require('./src/services/Basic'),
        BasicMain: require('./src/services/BasicMain'),
        BlockSubscribe: require('./src/services/BlockSubscribe'),
        BlockSubscribeRestore: require('./src/services/BlockSubscribeRestore'),
        MongoDB: require('./src/services/MongoDB'),
        Connector: require('./src/services/Connector'),
    },
    utils: {
        BlockChainValues: require('./src/utils/BlockChainValues'),
        Logger: require('./src/utils/Logger'),
        Moments: require('./src/utils/Moments'),
        Template: require('./src/utils/Template'),
        statsClient: require('./src/utils/statsClient'),
        defaultStarter: require('./src/utils/defaultStarter'),
    },
    data: {
        httpError: require('./src/data/httpError'),
    }
};
