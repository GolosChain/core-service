const mongoose = require('mongoose');
const env = require('../data/env');
const Logger = require('../utils/Logger');
const BasicService = require('./Basic');
const metrics = require('../utils/metrics');

/**
 * Сервис взаимодействия с базой данных MongoDB.
 * Содержит методы для подключения к базе данных,
 * а также обертку для создания моделей формата Mongoose.Schema.
 */
class MongoDB extends BasicService {
    /**
     * Создание модели по объекту-конфигу.
     * Дополнительно вторым аргументом можно указать конфиг,
     * который будет применяться к уже готовой схеме,
     * например составные индексы.
     * О схемах детальнее описано в документации Mongoose.
     * @param {string} name Имя модели.
     * @param {Object} schemaConfig Схема-конфиг модели в виде простого объета.
     * @param {Object} [optionsConfig] Конфиг настроек уровня схемы.
     * @param {Array<Object,Object>} optionsConfig.index
     * Массив конфигов индексов, состоящий из объектов с ключем fields
     * для обозначения полей индекса и ключем options для дополнительных опций.
     * Например {fields: {user: 1, data: 1}, options: {sparse: true}}
     * опишет составной индекс с указанием пропуска значений с null.
     * О схемах детальнее описано в документации Mongoose.
     * @param {Object} optionsConfig.schema Дополнительные общие настройки
     * для Mongoose схемы.
     * @returns {Model} Модель.
     */
    static makeModel(name, schemaConfig, optionsConfig = {}) {
        const schema = new mongoose.Schema(
            schemaConfig,
            Object.assign({ timestamps: true }, optionsConfig.schema)
        );

        if (optionsConfig.index) {
            for (let indexConfig of optionsConfig.index) {
                schema.index(indexConfig.fields, indexConfig.options);
            }
        }

        return mongoose.model(name, schema);
    }

    /**
     * Получение объекта драйвера, который используется в данном классе.
     * Необходимо для выполнения операций непосредственно с голым драйвером mongoose
     * @returns {mongoose}
     */
    static get mongoose(){
        return mongoose
    }

    /**
     * @deprecated
     * Получение типов схем, необходимо для обозначения особых
     * типов полей для моделей.
     * @returns {Mongoose.Schema.Types} Типы схем.
     */
    static get type() {
        return mongoose.Schema.Types;
    }

    /**
     * Получение типов схем, необходимо для обозначения особых
     * типов полей для моделей.
     * @returns {Mongoose.Schema.Types} Типы схем.
     */
    static get schemaTypes() {
        return mongoose.Schema.Types;
    }

    /**
     * Получение коллекции конструкторов типов данных MongoDB.
     * @returns {Mongoose.Types} Типы схем.
     */
    static get mongoTypes() {
        return mongoose.Types;
    }

    /**
     * Запуск, подключение к базе даннх на основе переменных
     * окружения, либо по явно указанной строке подключеня.
     * @param {string/null} [forceConnectString] Строка подключения,
     * не обязательна.
     * @param {Object} [options] Настройки подключения к базе.
     * @returns {Promise<*>} Промис без экстра данных.
     */
    async start(forceConnectString = null, options = {}) {
        return new Promise(resolve => {
            const connection = mongoose.connection;

            connection.on('error', error => {
                metrics.inc('mongo_error');
                Logger.error('MongoDB error:', error);
                process.exit(1);
            });
            connection.once('open', () => {
                Logger.info('MongoDB connection established.');
                resolve();
            });

            mongoose.connect(
                forceConnectString || env.GLS_MONGO_CONNECT,
                { useNewUrlParser: true, ...options }
            );
        });
    }

    /**
     * Остановка, отключение от базы данных.
     * @returns {Promise<void>} Промис без экстра данных.
     */
    async stop() {
        await mongoose.disconnect();
        Logger.info('MongoDB disconnected.');
    }
}

module.exports = MongoDB;
