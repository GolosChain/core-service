// Описание переменных окружения смотри в Readme.
const env = process.env;

module.exports = {
    GLS_MONGO_CONNECT_STRING: env.GLS_MONGO_CONNECT_STRING || 'mongodb://mongo/admin',
    GLS_BLOCKCHAIN_SUBSCRIBE_TIMEOUT: env.GLS_BLOCKCHAIN_SUBSCRIBE_TIMEOUT || 60000,
    GLS_DAY_START: env.GLS_DAY_START || 3,
    GLS_BLOCKCHAIN_NODE_ADDRESS: env.GLS_BLOCKCHAIN_NODE_ADDRESS || 'wss://ws.golos.io',
    GLS_METRICS_HOST: env.GLS_METRICS_HOST || 'localhost',
    GLS_METRICS_PORT: env.GLS_METRICS_PORT || 8125,
    GLS_GATE_LISTEN_HOST: env.GLS_GATE_LISTEN_HOST || 8080,
    GLS_GATE_LISTEN_PORT: env.GLS_GATE_LISTEN_PORT || 8080,
};
