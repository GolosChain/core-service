// Описание переменных окружения смотри в Readme.
const env = process.env;

const DEFAULT_NATS_NODE_ID = '_';

let natsConnect;

if (env.GLS_BLOCKCHAIN_BROADCASTER_CONNECT) {
    const connectEnv = env.GLS_BLOCKCHAIN_BROADCASTER_CONNECT;

    // If legacy single node format
    if (connectEnv.startsWith('nats://')) {
        natsConnect = {
            [DEFAULT_NATS_NODE_ID]: connectEnv,
        };
    } else {
        natsConnect = JSON.parse(connectEnv);
    }
}

module.exports = {
    DEFAULT_NATS_NODE_ID,
    GLS_MONGO_CONNECT: env.GLS_MONGO_CONNECT || 'mongodb://mongo/admin',
    GLS_DAY_START: Number(env.GLS_DAY_START) || 3,
    GLS_METRICS_HOST: env.GLS_METRICS_HOST || '127.0.0.1',
    GLS_METRICS_PORT: Number(env.GLS_METRICS_PORT) || 9777,
    GLS_CONNECTOR_HOST: env.GLS_CONNECTOR_HOST || '0.0.0.0',
    GLS_CONNECTOR_PORT: Number(env.GLS_CONNECTOR_PORT) || 3000,
    GLS_BLOCKCHAIN_BROADCASTER_SERVER_NAME: env.GLS_BLOCKCHAIN_BROADCASTER_SERVER_NAME,
    GLS_BLOCKCHAIN_BROADCASTER_CLIENT_NAME: env.GLS_BLOCKCHAIN_BROADCASTER_CLIENT_NAME,
    GLS_BLOCKCHAIN_BROADCASTER_CONNECT: natsConnect,
    GLS_BLOCK_SUBSCRIBER_REPLAY_TIME_DELTA:
        Number(env.GLS_BLOCK_SUBSCRIBER_REPLAY_TIME_DELTA) || 600000,
    GLS_BLOCK_SUBSCRIBER_CLEANER_INTERVAL:
        Number(env.GLS_BLOCK_SUBSCRIBER_CLEANER_INTERVAL) || 600000,
    GLS_BLOCK_SUBSCRIBER_LAST_BLOCK_STORE:
        Number(env.GLS_BLOCK_SUBSCRIBER_LAST_BLOCK_STORE) || 1000,
    GLS_EXTERNAL_CALLS_METRICS:
        Boolean(env.GLS_EXTERNAL_CALLS_METRICS) && env.GLS_EXTERNAL_CALLS_METRICS !== 'false',
    GLS_SYSTEM_METRICS: Boolean(env.GLS_SYSTEM_METRICS) && env.GLS_SYSTEM_METRICS !== 'false',
    GLS_USE_ONLY_RECENT_BLOCKS:
        Boolean(env.GLS_USE_ONLY_RECENT_BLOCKS) && env.GLS_USE_ONLY_RECENT_BLOCKS !== 'false',
    GLS_LOCAL_METRICS: parseLocalMetricsEnv(),
    GLS_PRESERVE_LOCAL_METRICS:
        Boolean(env.GLS_PRESERVE_LOCAL_METRICS) && env.GLS_PRESERVE_LOCAL_METRICS !== 'false',
    GLS_WAIT_FOR_TRANSACTION_TIMEOUT: Number(env.GLS_WAIT_FOR_TRANSACTION_TIMEOUT) || 300000,
    GLS_CYBERWAY_CONNECT: env.GLS_CYBERWAY_CONNECT,
    GLS_RECENT_BLOCKS_TIME_DELTA: env.GLS_RECENT_BLOCKS_TIME_DELTA || 5 * 60 * 1000,
    GLS_SAVE_GENESIS_EXAMPLES:
        Boolean(env.GLS_SAVE_GENESIS_EXAMPLES) && env.GLS_SAVE_GENESIS_EXAMPLES !== 'false',
    GLS_NATS_MAX_IN_FLIGHT: Number(env.GLS_NATS_MAX_IN_FLIGHT) || 10,
    GLS_SKIP_MISSING_TRANSACTIONS:
        Boolean(env.GLS_SKIP_MISSING_TRANSACTIONS) && env.GLS_SKIP_MISSING_TRANSACTIONS !== 'false',
    GLS_DB_LOGS_ENABLED: env.GLS_DB_LOGS_ENABLED === 'true',
};

function parseLocalMetricsEnv() {
    if (!env.GLS_LOCAL_METRICS || env.GLS_LOCAL_METRICS === 'false') {
        return false;
    }

    if (env.GLS_LOCAL_METRICS === 'file') {
        return 'file';
    }

    return 'log';
}
