module.exports = {
    controllers: {
        Basic: require('./src/controllers/Basic'),
    },
    services: {
        Basic: require('./src/services/Basic'),
        BasicMain: require('./src/services/BasicMain'),
        BlockSubscribe: require('./src/services/BlockSubscribe'),
        MongoDB: require('./src/services/MongoDB'),
        Connector: require('./src/services/Connector'),
    },
    utils: {
        Logger: require('./src/utils/Logger'),
        Moments: require('./src/utils/Moments'),
        Template: require('./src/utils/Template'),
        RpcObject: require('./src/utils/RpcObject'),
        statsClient: require('./src/utils/statsClient'),
        ServiceMeta: require('./src/utils/ServiceMeta'),
        Content: require('./src/utils/Content'),
        defaultStarter: require('./src/utils/defaultStarter'),
        GateClient: require('./src/utils/GateClient'),
    },
    types: {
        BigNum: require('./src/types/BigNum'),
        MongoBigNum: require('./src/types/MongoBigNum'),
    },
    data: {
        env: require('./src/data/env'),
    },
};
