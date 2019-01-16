const Logger = require('./Logger');

/**
 * Класс для хранения глобальных мета-данных микросервиса.
 *
 * Мета-данные, известные ядру:
 *     name - Имя микросервиса.
 */
class ServiceMeta {
    /**
     * Получить мета-данные.
     * @param {string} key Ключ.
     * @return {*} Хранящееся значение.
     */
    static get(key) {
        return this._store[key];
    }

    /**
     * Записать мета-данные.
     * @param {string} key Ключ.
     * @param {*} value Значение для хранения.
     */
    static set(key, value) {
        this._store[key] = value;

        switch (key) {
            case 'name':
                Logger.info(`Service name is - ${value}`);
                break;
            default:
                Logger.info(`Meta defined - ${key} = ${value}`);
        }
    }
}

ServiceMeta._store = {};

module.exports = ServiceMeta;
