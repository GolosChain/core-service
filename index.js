module.exports = {
    Logger: require('./src/Logger'),
    Moments: require('./src/Moments'),
    Stats: require('./src/Stats'),
    service: {
        Basic: require('./src/service/Basic'),
        BlockSubscribe: require('./src/service/BlockSubscribe'),
        MongoDB: require('./src/service/MongoDB'),
        Gate: require('./src/service/Gate'),
    },
};
