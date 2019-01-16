const jayson = require('jayson');

/**
 * Утилита для формирования RPC-объектов для протокола общения.
 * Необходима только для ручной работы с протоколом, во всех
 * остальных случаях достаточно придерживаться Connector api
 * (смотри класс services/Connector).
 */
class RpcObject {
    /**
     * Сформировать успешный ответ.
     * @param {Object/null} result [Результат].
     * @param {number/string/null} [id] Идентификатор ответа.
     */
    static success(result, id) {
        return this.response(null, result, id);
    }

    /**
     * Сформировать ответ с ошибкой.
     * @param {Object/number/null} errorOrErrorCode Объект ошибки или код ошибки.
     * @param {number/null} [errorOrErrorCode.code] Код ошибки.
     * @param {string/null} [errorOrErrorCode.message] Описание ошибки.
     * @param {string/null} [messageText] Описание ошибки (если первый аргумент был код).
     */
    static error(errorOrErrorCode, messageText) {
        let code;
        let message;

        if (arguments.length === 1) {
            code = arguments[0].code;
            message = arguments[0].message;
        } else {
            code = arguments[0];
            message = arguments[1];
        }

        const error = jayson.server.prototype.error(code, message);

        return this.response(error);
    }

    /**
     * Сформировать ответ.
     * @param {Object/null} [error] Объект ошибки (нет если result).
     * @param {Object/null} [result] Результат (нет если error, но может быть и пустым).
     * @param {number/string/null} [id] Идентификатор ответа.
     */
    static response(error, result, id) {
        return jayson.utils.response(error, result, id);
    }

    /**
     * Сформировать запрос.
     * @param {string} method Метод запроса.
     * @param {Object/null} [data] Данные для запроса.
     * @param {number/string/null} [id] Идентификатор запроса.
     */
    static request(method, data, id) {
        return jayson.utils.request(method, data, id);
    }
}

module.exports = RpcObject;
