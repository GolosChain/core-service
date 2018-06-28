const mongoose = require('mongoose');
const env = require('../Env');
const logger = require('../Logger');
const BasicService = require('../service/Basic');
const stats = require('../Stats').client;

/**
 * Сервис взаимодействия с базой данных MongoDB.
 * Содержит методы для подключения к базе данных,
 * а также обертку для создания моделей формата Mongoose.Schema.
 */
class MongoDB extends BasicService {
    /**
     * Создание модели по объекту-конфигу.
     * О схемах детальнее описано в документации Mongoose.
     * @param {string} name Имя модели.
     * @param {Object} config Схема-конфиг модели в виде простого объета.
     * @returns {Model} Модель.
     */
    static makeModel(name, config) {
        return mongoose.model(name, new mongoose.Schema(config));
    }

    /**
     * Получение типов схем, необходимо для обозначения особых
     * типов полей для моделей.
     * @returns {Mongoose.Schema.Types} Типы схем.
     */
    static get type() {
        return mongoose.Schema.Types;
    }

    /**
     * Запуск, подключение к базе даннх на основе переменных
     * окружения, либо по явно указанной строке подключеня.
     * @param {string/null} forceConnectString Строка подключения,
     * не обязательна.
     * @returns {Promise<any>} Промис без экстра данных.
     */
    async start(forceConnectString = null) {
        return new Promise(resolve => {
            const connection = mongoose.connection;

            connection.on('error', error => {
                stats.increment('mongo_error');
                logger.error(`MongoDB - ${error}`);
                process.exit(1);
            });
            connection.once('open', () => {
                stats.increment('mongo_connected');
                logger.info('MongoDB connection established.');
                resolve();
            });

            mongoose.connect(forceConnectString || env.MONGO_CONNECT_STRING);
        });
    }

    /**
     * Остановка, отключение от базы данных.
     * @returns {Promise<void>} Промис без экстра данных.
     */
    async stop() {
        await mongoose.disconnect();
        logger.info('MongoDB disconnected.');
    }
}

module.exports = MongoDB;
