// Описание переменных окружения смотри в Readme.
const env = process.env;

module.exports = {
    MONGO_CONNECT_STRING:
        env.MONGO_CONNECT_STRING || 'mongodb://mongo/admin',
    BLOCKCHAIN_SUBSCRIBE_TIMEOUT: env.BLOCKCHAIN_SUBSCRIBE_TIMEOUT || 60000,
    DAY_START: env.DAY_START || 3,
    BLOCKCHAIN_NODE_ADDRESS: env.BLOCKCHAIN_NODE_ADDRESS || 'wss://ws.golos.io',
    METRICS_HOST: env.METRICS_HOST || 'localhost',
    METRICS_PORT: env.METRICS_PORT || 8125,
};
