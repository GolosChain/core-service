module.exports = {
    controllers: {
        Basic: require('./src/controllers/Basic'),
    },
    services: {
        Basic: require('./src/services/Basic'),
        BasicMain: require('./src/services/BasicMain'),
        BlockSubscribe: require('./src/services/BlockSubscribe'),
        BlockSubscribeRestore: require('./src/services/BlockSubscribeRestore'),
        MongoDB: require('./src/services/MongoDB'),
        Connector: require('./src/services/Connector'),
    },
    utils: {
        Block: require('./src/utils/Block'),
        BlockChainValues: require('./src/utils/BlockChainValues'),
        Logger: require('./src/utils/Logger'),
        Moments: require('./src/utils/Moments'),
        Template: require('./src/utils/Template'),
        RpcObject: require('./src/utils/RpcObject'),
        statsClient: require('./src/utils/statsClient'),
        defaultStarter: require('./src/utils/defaultStarter'),
    },
    data: {
        env: require('./src/data/env'),
    },
};
