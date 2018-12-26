const jayson = require('jayson');
const env = require('../data/env');
const logger = require('../utils/Logger');
const BasicService = require('./Basic');
const stats = require('../utils/statsClient');

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
 * @param {string} serviceName - используется для сбора статистики
 */
class Connector extends BasicService {
    constructor(serviceName) {
        super();

        if (!serviceName) {
            throw new Error('No service name');
        }

        this._serviceName = serviceName;
        this._server = null;
        this._clientsMap = new Map();
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
            this._clientsMap.get(service).request(method, data, (error, response) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(response);
                }
            });
        });
    }

    _startServer(rawRoutes) {
        return new Promise((resolve, reject) => {
            const routes = this._wrapRoutes(rawRoutes);

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

    _wrapRoutes(originalRoutes) {
        const routes = {};

        for (const route of Object.keys(originalRoutes)) {
            const originHandler = originalRoutes[route];

            routes[route] = async (params, callback) => {
                const startTs = Date.now();
                let isError = true;

                try {
                    let data = await originHandler(params);

                    if (!data || data === 'Ok') {
                        data = { status: 'OK' };
                    }

                    callback(null, data);
                } catch (err) {
                    isError = true;
                    this._handleHandlerError(callback, err);
                } finally {
                    const time = Date.now() - startTs;

                    let suffix = '';

                    if (isError) {
                        suffix = '_error';
                    }

                    stats.timing(`${this._serviceName}_api_call${suffix}`, time);
                    stats.timing(`${this._serviceName}_api_${route}${suffix}`, time);
                }
            };
        }

        return routes;
    }

    _handleHandlerError(callback, error) {
        for (const InternalErrorType of [
            EvalError,
            RangeError,
            ReferenceError,
            SyntaxError,
            TypeError,
            URIError,
        ]) {
            if (error instanceof InternalErrorType) {
                logger.error(`Internal route error: ${error.stack}`);
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

        logger.error(error);
        callback({}, null);
    }
}

module.exports = Connector;
