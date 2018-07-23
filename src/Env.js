// Описание переменных окружения смотри в Readme.
const env = process.env;

module.exports = {
    GLS_MONGO_CONNECT: env.GLS_MONGO_CONNECT || 'mongodb://mongo/admin',
    GLS_BLOCKCHAIN_SUBSCRIBE_TIMEOUT: env.GLS_BLOCKCHAIN_SUBSCRIBE_TIMEOUT || 60000,
    GLS_DAY_START: env.GLS_DAY_START || 3,
    GLS_BLOCKCHAIN_CONNECT: env.GLS_BLOCKCHAIN_CONNECT || 'wss://ws.golos.io',
    GLS_METRICS_HOST: env.GLS_METRICS_HOST || 'localhost',
    GLS_METRICS_PORT: env.GLS_METRICS_PORT || 8125,
    GLS_GATE_HOST: env.GLS_GATE_HOST || '127.0.0.1',
    GLS_GATE_PORT: env.GLS_GATE_PORT || 8080,
};
