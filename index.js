module.exports = {
    controllers: {
        Basic: require('./src/controllers/Basic'),
    },
    services: {
        Basic: require('./src/services/Basic'),
        BasicMain: require('./src/services/BasicMain'),
        BlockSubscribe: require('./src/services/BlockSubscribe'),
        BlockSubscribeDirect: require('./src/services/BlockSubscribeDirect'),
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
        ServiceMeta: require('./src/utils/ServiceMeta'),
        defaultStarter: require('./src/utils/defaultStarter'),
    },
    types: {
        BigNum: require('./src/types/BigNum'),
        MongoBigNum: require('./src/types/MongoBigNum'),
    },
    data: {
        env: require('./src/data/env'),
    },
};
