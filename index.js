module.exports = {
    Logger: require('./src/Logger'),
    Moments: require('./src/Logger'),
    Stats: require('./src/Logger'),
    service: {
        Basic: require('./src/service/Basic'),
        BlockSubscribe: require('./src/service/BlockSubscribe'),
        MongoDB: require('./src/service/MongoDB'),
    },
};
