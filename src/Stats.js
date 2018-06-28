const StatsDClient = require('node-statsd');
const env = require('./Env');
const logger = require('./Logger');

/**
 * Класс-обертка для StatsD (получение статуса о работоспособности сервиса).
 * Автоматически инициализирует сервис при попытке получить клиент для
 * взаимодействия.
 */
class Stats {
    /**
     * Получение клиента для StatsD сервера.
     * Автоматически создает подключение в случае отсутствия.
     * @returns {StatsDClient} Клиент.
     */
    static get client() {
        if (!this._client) {
            this._init();
        }

        return this._client;
    }

    static _init() {
        this._client = new StatsDClient({
            host: env.METRICS_HOST,
            port: env.METRICS_PORT,
        });

        this._client.socket.on('error', error => {
            logger.error(`Metrics error - ${error}`);
        });
    }
}

module.exports = Stats;
