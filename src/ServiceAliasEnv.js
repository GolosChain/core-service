// Описание переменных окружения смотри в Readme.
const env = process.env;

module.exports = {
    solzhenitsyn: env.SOLZHENITSYN_CONNECT_STRING,
    bulgakov: env.BULGAKOV_CONNECT_STRING,
    notify: env.NOTIFY_CONNECT_STRING,
};
