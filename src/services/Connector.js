const jayson = require('jayson');
const env = require('../data/env');
const Logger = require('../utils/Logger');
const BasicService = require('./Basic');
const stats = require('../utils/statsClient');
const ServiceMeta = require('../utils/ServiceMeta');

/**
 * Сервис связи между микросервисами.
 * При необходимости поднимает сервер обработки входящих подключений и/или
 * обработчики запросов исходящих запросов.
 * Работает посредством JSON-RPC.
 * Сервер связи конфигурируется объектом роутинга вида:
 *
 *  ```
 *  transfer: (data) => handler(data),
 *  history: this._handler.bind(this),
 *  ...
 *  ```
 *
 * В обработчик попадает объект из params JSON-RPC.
 *
 * Для конфигурации исходящих запросов необходимо передать объект вида:
 *
 *  ```
 *  alias1: 'http://connect.string1',
 *  alias2: 'http://connect.string2',
 *  ...
 *  ```
 *
 * Ключ является алиасом для отправки последующих запросов через метод sendTo.
 */
class Connector extends BasicService {
    constructor() {
        super();

        this._server = null;
        this._clientsMap = new Map();
        this._defaultResponse = { status: 'OK' };
        this._useEmptyResponseCorrection = true;
    }

    /**
     * Запуск сервиса с конфигурацией.
     * Все параметры являются не обязательными.
     * @param [serverRoutes] Конфигурация роутера, смотри описание класса.
     * @param [requiredClients] Конфигурация необходимых клиентов, смотри описание класса.
     * @returns {Promise<void>} Промис без экстра данных.
     */
    async start({ serverRoutes, requiredClients }) {
        if (serverRoutes) {
            await this._startServer(serverRoutes);
        }

        if (requiredClients) {
            this._makeClients(requiredClients);
        }
    }

    /**
     * Остановка сервиса.
     * @returns {Promise<void>} Промис без экстра данных.
     */
    async stop() {
        if (this._server) {
            this._server.close();
        }
    }

    /**
     * Оправка данных указанному микросервису.
     * @param {string} service Имя-алиас микросервиса.
     * @param {string} method Метод JSON-RPC.
     * @param {*} data Любые данные.
     * @returns {Promise<*>} Данные ответа либо ошибка.
     */
    sendTo(service, method, data) {
        return new Promise((resolve, reject) => {
            const startTs = Date.now();

            this._clientsMap.get(service).request(method, data, (error, response) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(response);
                }

                this._reportStats({
                    method: `${service}.${method}`,
                    type: 'call',
                    startTs,
                    isError: Boolean(error),
                });
            });
        });
    }

    /**
     * Вызов метода микросервиса.
     * @param {string} service Имя-алиас микросервиса.
     * @param {string} method Метод JSON-RPC.
     * @param {Object} params Параметры запроса.
     * @returns {Promise<*>} Ответ.
     */
    async callService(service, method, params) {
        const response = await this.sendTo(service, method, params);

        if (response.error) {
            throw response.error;
        }

        return response.result;
    }

    /**
     * Получить текущее значение, которое возвращается
     * в ответе в случае если ответ пуст (эквивалентен false)
     * или равен 'Ok' (legacy).
     * Дефолтное значение - { status: 'OK' }.
     * @return {*} Значение.
     */
    getDefaultResponse() {
        return this._defaultResponse;
    }

    /**
     * Установить значение, которое возвращается
     * в ответе в случае если ответ пуст (эквивалентен false)
     * или равен 'Ok' (legacy).
     * Дефолтное значение - { status: 'OK' }.
     * @param {*} value Значение.
     */
    setDefaultResponse(value) {
        this._defaultResponse = value;
    }

    /**
     * Включить коррекцию ответа в случае пустого ответа
     * (эквивалентного false) или равного 'Ok' (legacy),
     * которая заменяет пустой ответ на дефолтный
     * (например на { status: 'OK' }).
     * Изначально включено.
     */
    enableEmptyResponseCorrection() {
        this._useEmptyResponseCorrection = true;
    }

    /**
     * Выключить коррекцию ответа в случае пустого ответа
     * (эквивалентного false) или равного 'Ok' (legacy),
     * которая заменяет пустой ответ на дефолтный
     * (например на { status: 'OK' }).
     * Изначально включено.
     */
    disableEmptyResponseCorrection() {
        this._useEmptyResponseCorrection = false;
    }

    _startServer(rawRoutes) {
        return new Promise((resolve, reject) => {
            const routes = this._normalizeRoutes(rawRoutes);

            this._server = jayson.server(routes).http();

            this._server.listen(env.GLS_CONNECTOR_PORT, env.GLS_CONNECTOR_HOST, error => {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        });
    }

    _makeClients(requiredClients) {
        for (let alias of Object.keys(requiredClients)) {
            const connectString = requiredClients[alias];
            const client = new jayson.client.http(connectString);

            this._clientsMap.set(alias, client);
        }
    }

    _normalizeRoutes(originalRoutes) {
        const routes = {};

        for (const route of Object.keys(originalRoutes)) {
            const originHandler = originalRoutes[route];

            routes[route] = this._wrapMethod(route, originHandler);
        }

        return routes;
    }

    _wrapMethod(route, originHandler) {
        return async (params, callback) => {
            const startTs = Date.now();
            let isError = false;

            try {
                let data = await originHandler(params);

                if (this._useEmptyResponseCorrection && (!data || data === 'Ok')) {
                    data = this._defaultResponse;
                }

                callback(null, data);
            } catch (err) {
                isError = true;
                this._handleHandlerError(callback, err);
            }

            this._reportStats({
                method: route,
                type: 'handle',
                startTs,
                isError,
            });
        };
    }

    _reportStats({ method, type, startTs, isError = false }) {
        const time = Date.now() - startTs;
        let status;

        if (isError) {
            status = 'failure';
        } else {
            status = 'success';
        }

        const serviceName = ServiceMeta.get('name');
        const general = `${serviceName}:${type}_api_${status}`;
        const details = `${serviceName}:${type}_${method}_${status}`;

        stats.increment(`${general}_count`);
        stats.timing(`${general}_time`, time);
        stats.increment(`${details}_count`);
        stats.timing(`${details}_time`, time);
    }

    _handleHandlerError(callback, error) {
        for (const InternalErrorType of [
            EvalError,
            RangeError,
            ReferenceError,
            SyntaxError,
            URIError,
        ]) {
            if (error instanceof InternalErrorType) {
                Logger.error(`Internal route error: ${error.stack}`);
                process.exit(1);
            }
        }

        if (error.code === 'ECONNREFUSED') {
            callback({ code: 1001, message: 'Internal server error' }, null);
            return;
        }

        if (!(error instanceof Error) && error.code && error.message) {
            callback(error, null);
            return;
        }

        Logger.error(error);
        callback({}, null);
    }
}

module.exports = Connector;
