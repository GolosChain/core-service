module.exports = {
    Logger: require('./src/Logger'),
    Moments: require('./src/Moments'),
    Stats: require('./src/Stats'),
    ServiceAliasEnv: require('./src/ServiceAliasEnv'),
    service: {
        Basic: require('./src/service/Basic'),
        BlockSubscribe: require('./src/service/BlockSubscribe'),
        BlockSubscribeRestore: require('./src/service/BlockSubscribeRestore'),
        MongoDB: require('./src/service/MongoDB'),
        Gate: require('./src/service/Gate'),
    },
};
