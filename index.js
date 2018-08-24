module.exports = {
    Logger: require('./src/Logger'),
    Moments: require('./src/Moments'),
    Stats: require('./src/Stats'),
    HttpError: require('./src/HttpError'),
    Template: require('./src/Template'),
    service: {
        Basic: require('./src/service/Basic'),
        BlockSubscribe: require('./src/service/BlockSubscribe'),
        BlockSubscribeRestore: require('./src/service/BlockSubscribeRestore'),
        MongoDB: require('./src/service/MongoDB'),
        Gate: require('./src/service/Gate'),
    },
    utils: {
        BlockChainValues: require('./src/utils/BlockChainValues'),
    },
};
