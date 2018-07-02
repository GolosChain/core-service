// Описание переменных окружения смотри в Readme.
const env = process.env;
const Moments = require('./Moments');
const minute = Moments.oneMinute;

module.exports = {
    MONGO_CONNECT_STRING: env.MONGO_CONNECT_STRING || 'mongodb://mongo/admin',
    BLOCKCHAIN_SUBSCRIBE_TIMEOUT: env.BLOCKCHAIN_SUBSCRIBE_TIMEOUT || minute,
    DAY_START: env.DAY_START || 3,
    BLOCKCHAIN_NODE_ADDRESS: env.BLOCKCHAIN_NODE_ADDRESS || 'wss://ws.golos.io',
    METRICS_HOST: env.METRICS_HOST || 'localhost',
    METRICS_PORT: env.METRICS_PORT || 8125,
    GATE_SERVER_PORT: env.GATE_SERVER_PORT || 8090,
    GATE_SERVER_TIMEOUT: env.GATE_SERVER_TIMEOUT || minute,
};
