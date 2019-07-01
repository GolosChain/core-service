const merge = require('deepmerge');
const Ajv = require('ajv');
const ajv = new Ajv({ useDefaults: true });
const jayson = require('jayson');
const env = require('../data/env');
const Logger = require('../utils/Logger');
const BasicService = require('./Basic');
const metrics = require('../utils/metrics');

/**
 * Сервис связи между микросервисами.
 * При необходимости поднимает сервер обработки входящих подключений и/или
 * обработчики запросов исходящих запросов.
 * Работает посредством JSON-RPC.
 * Сервер связи конфигурируется объектом роутинга в двух вариациях.
 *
 * Лаконичная:
 *
 * ```
 * serverRoutes: {
 *     transfer: (data) => handler(data),
 *     history: this._handler.bind(this),
 * }
 * ...
 * ```
 *
 * Полная и с ajv валидацией:
 *
 * ```
 * serverRoutes: {
 *     transfer: {
 *         handler: this._handler,  // Обработчик вызова
 *         scope: this,             // Скоуп вызова обработчика
 *         validation: {            // ajv-схема валидации параметров
 *             required: ['name'],
 *             properties: {
 *                 name: {
 *                     type: 'string'
 *                 },
 *                 count: {
 *                     type: 'number'
 *                 },
 *             }
 *         }
 *     }
 * }
 * ...
 * ```
 *
 * Стоит учитывать что валидация сразу устанавливает запрет на отправку дополнительных
 * полей и предполагает что параметры будут именно объектом, что соответствует
 * конфигу ajv:
 *
 * ```
 * type: 'object',
 * additionalProperties: false,
 * ```
 *
 * Также имеется возможность указать пре-обработчики и пост-обработчики.
 * Пре, пост и оргигинальный обработчик работают по принципу конвеера -
 * если они что-либо возвращают - оно будет передано далее, в ином случае
 * далее будет переданы оригинальные аргументы, но передачей по ссылке -
 * если аргумент был объектом и его поля были изменены - изменения
 * будут содержаться и в следующем обработчике. Самый первый обработчик
 * получает оригинал данных от клиента, а данные последнего обработчика
 * будут отправлены клиенту как ответ. Особое поведение лишь у оригинального
 * обработчика - в случае отсутствия ответа (значение undefined)
 * будет передано именно это значение, а не аргументы.
 *
 * ```
 * serverRoutes: {
 *     transfer: {
 *         before: [
 *             {
 *                 handler: this.checkAuth,
 *                 scope: this,
 *             },
 *             {
 *                 handler: this.convertIds
 *                 scope: this,
 *             },
 *         ]
 *         after: [
 *             {
 *                 handler: this.transformResult,
 *                 scope: this,
 *             },
 *         ]
 *         handler: this._handler,  // Обработчик вызова
 *         scope: this,             // Скоуп вызова обработчика
 *     }
 * }
 * ...
 * ```
 *
 * При необходимости можно вынести повторяющиеся части в дефолтный конфиг
 * и унаследоваться от него через алиас.
 * В случае указания одного или нескольких extends сначала будет взят
 * первый конфиг, сверху добавлены с перезаписью и глубоким мержем
 * остальные, в конце добавляется оригинал.
 *
 * В данном примере мы создаем роут 'transfer' и наследуем валидацию
 * от конфига 'auth', которая добавляет нам обязательное поле 'secret'.
 *
 * ```
 * serverRoutes: {
 *     transfer: {
 *         handler: this._handler,  // Обработчик вызова
 *         scope: this,             // Скоуп вызова обработчика
 *         inherits: ['auth']       // Имя парент-конфига
 *     }
 * },
 * serverDefaults: {
 *     parents: {                         // Пречисление конфигов
 *         auth: {                        // Имя конфига
 *             validation: {              // Дефолтные данные валидации.
 *                 required: ['secret'],
 *                 properties: {
 *                     secret: {
 *                         type: 'string'
 *                     },
 *                 }
 *             }
 *         }
 *     }
 * }
 * ...
 * ```
 *
 * Для удобства валидации можно добавить собственные типы валидации
 * основанные на базовых. Типы поддерживаются внутри конфигурации
 * properties, а также внутри oneOf, anyOf и allOf.
 *
 * В данном примере мы добавляем и используем тип, который валидирует
 * параметр как строку, устанавливает максимальную длинну в 100 символов,
 * а также разрешаем параметру быть типом null.
 *
 * ```
 * serverRoutes: {
 *     transfer: {
 *         handler: this._handler,
 *         scope: this,
 *         validation: {
 *             required: ['message']
 *             properties: {
 *                 message: {
 *                     type: 'message'   // Используем наш нестандартный тип
 *                 }
 *             }
 *         }
 *     }
 * },
 * serverDefaults: {
 *     validationTypes: {                // Объявляем что у нас есть нестандартные типы
 *         message: {                    // Указываем имя типа
 *             type: 'stringOrNull',     // Используем в основе наш тип 'stringOrNull'
 *             maxLength: 100            // Устанавливаем дополнительную валидацию
 *         },
 *         stringOrNull: {               // Указываем имя типа
 *             type: ['string', 'null']  // Используем встроенные типы 'string' и 'null'
 *         }
 *     }
 * }
 * ```
 *
 * Для того чтобы использовать метод `callService` необходимо задать алиасы
 * запросов - алиас является именем, которое указывает на ссылку куда необходимо
 * отправить запрос. Задать их можно двумя способами.
 *
 * Сразу в конфигурации в методе `start`:
 *
 *  ```
 *  requiredClients: {
 *      alias1: 'http://connect.string1',
 *      alias2: 'http://connect.string2',
 *  }
 *  ...
 *  ```
 *
 * Либо можно добавлять их динамически через метод `addService`.
 */
class Connector extends BasicService {
    /**
     * @param {string} [host] Адрес подключения, иначе возьмется из GLS_CONNECTOR_HOST.
     * @param {number} [port] Порт подключения, иначе возьмется из GLS_CONNECTOR_PORT.
     */
    constructor({ host = env.GLS_CONNECTOR_HOST, port = env.GLS_CONNECTOR_PORT } = {}) {
        super();

        this._host = host;
        this._port = port;

        this._server = null;
        this._clientsMap = new Map();
        this._defaultResponse = { status: 'OK' };
        this._useEmptyResponseCorrection = true;
    }

    /**
     * Запуск сервиса с конфигурацией.
     * Все параметры являются не обязательными.
     * @param [serverRoutes] Конфигурация роутера, смотри описание класса.
     * @param [serverDefaults] Конфигурация дефолтов сервера, смотри описание класса.
     * @param [requiredClients] Конфигурация необходимых клиентов, смотри описание класса.
     * @returns {Promise<void>} Промис без экстра данных.
     */
    async start({ serverRoutes, serverDefaults = {}, requiredClients }) {
        if (serverRoutes) {
            await this._startServer(serverRoutes, serverDefaults);
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

                if (env.GLS_EXTERNAL_CALLS_METRICS) {
                    this._reportStats({
                        type: 'call',
                        method: `${service}.${method}`,
                        startTs,
                        isError: Boolean(error),
                    });
                }
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
     * Динамически добавляет сервис к списку известных сервисов.
     * @param {string} service Имя-алиас микросервиса.
     * @param {string} connectString Строка подключения.
     */
    addService(service, connectString) {
        const client = new jayson.client.http(connectString);

        this._clientsMap.set(service, client);
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

    _startServer(rawRoutes, serverDefaults) {
        return new Promise((resolve, reject) => {
            const routes = this._normalizeRoutes(rawRoutes, serverDefaults);

            this._server = jayson.server(routes).http();

            this._server.listen(this._port, this._host, error => {
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
            this.addService(alias, requiredClients[alias]);
        }
    }

    _normalizeRoutes(originalRoutes, serverDefaults) {
        const routes = {};

        for (const route of Object.keys(originalRoutes)) {
            const originHandler = originalRoutes[route];
            const handler = this._tryApplyConfigInherits(originHandler, serverDefaults);

            routes[route] = this._wrapMethod(route, handler);
        }

        return routes;
    }

    _tryApplyConfigInherits(config, serverDefaults) {
        if (!config || typeof config === 'function') {
            return config;
        }

        if (config.validation) {
            this._applyValidation(config);
        }

        if (config.inherits) {
            this._applyInherits(config, serverDefaults);
        }

        if (config.validation && Object.keys(config.validation).length > 0) {
            this._applyCustomValidationTypes(config, serverDefaults);
            this._compileValidation(config);
        }

        return config;
    }

    _applyValidation(config) {
        config.validation = merge(this._getDefaultValidationInherits(), config.validation);
    }

    _applyInherits(config, serverDefaults) {
        const parents = serverDefaults.parents;
        const inherited = {
            before: [],
            after: [],
            validation: {},
        };

        for (const alias of config.inherits) {
            inherited.before.push(...(parents[alias].before || []));
            inherited.after.push(...(parents[alias].after || []));
            inherited.validation = merge(inherited.validation, parents[alias].validation || {});
        }

        config.before = config.before || [];
        config.after = config.after || [];
        config.validation = config.validation || {};

        config.before.unshift(...inherited.before);
        config.after.unshift(...inherited.after);
        config.validation = merge(inherited.validation, config.validation);
    }

    _applyCustomValidationTypes(config, serverDefaults) {
        if (!serverDefaults.validationTypes) {
            return;
        }

        this._resolveCustomInnerTypes(serverDefaults.validationTypes);
        this._resolveCustomTypesForValidation(config.validation, serverDefaults.validationTypes);
    }

    _resolveCustomInnerTypes(types) {
        for (const typeConfig of Object.values(types)) {
            this._resolveValidationType(typeConfig, types);
        }
    }

    _resolveCustomTypesForValidation(validation, types) {
        for (const propertyName of ['properties', 'oneOf', 'allOf', 'anyOf']) {
            const validationInner = validation[propertyName];

            if (validationInner) {
                for (const typeConfig of Object.values(validationInner)) {
                    this._resolveValidationType(typeConfig, types);
                    this._resolveCustomTypesForValidation(typeConfig, types);
                }
            }
        }
    }

    _resolveValidationType(typeConfig, types) {
        let typeDefinition = typeConfig.type;

        if (!Array.isArray(typeDefinition)) {
            typeDefinition = [typeDefinition];
        }

        this._resolveValidationTypeForDefinition(typeConfig, typeDefinition, types);

        typeDefinition = [...new Set(typeDefinition)];

        if (typeDefinition.length === 1) {
            typeDefinition = typeDefinition[0];
        }

        typeConfig.type = typeDefinition;
    }

    _resolveValidationTypeForDefinition(typeConfig, typeDefinition, types) {
        for (let i = 0; i < typeDefinition.length; i++) {
            const customType = types[typeDefinition[i]];

            if (!customType) {
                continue;
            }

            typeDefinition[i] = customType.type;

            this._mergeTypeValidationProperties(customType, typeConfig);

            let currentTypes = typeDefinition[i];

            if (!Array.isArray(currentTypes)) {
                currentTypes = [currentTypes];
            } else {
                typeDefinition.splice(i, 1, ...currentTypes);
            }

            if (currentTypes.some(type => types[type])) {
                // Resolve again
                i--;
            }
        }
    }

    _mergeTypeValidationProperties(customType, typeConfig) {
        for (const key of Object.keys(customType)) {
            if (key === 'type') {
                continue;
            }

            if (!typeConfig[key]) {
                typeConfig[key] = customType[key];
            } else if (typeof typeConfig[key] === 'object') {
                typeConfig[key] = merge(customType[key], typeConfig[key]);
            } else {
                // save original value as override
            }
        }
    }

    _compileValidation(config) {
        config.validator = ajv.compile(config.validation);
    }

    _wrapMethod(route, originHandler) {
        return async (params, callback) => {
            const startTs = Date.now();
            let isError = false;

            try {
                let data;

                if (typeof originHandler === 'function') {
                    data = await originHandler(params);
                } else {
                    data = await this._handleWithOptions(originHandler, params);
                }

                if (this._useEmptyResponseCorrection && (!data || data === 'Ok')) {
                    data = this._defaultResponse;
                }

                callback(null, data);
            } catch (err) {
                isError = true;
                this._handleHandlerError(callback, err);
            }

            this._reportStats({
                type: 'handle',
                method: route,
                startTs,
                isError,
            });
        };
    }

    async _handleWithOptions(config, params) {
        let { handler: originalHandler, scope, validator, before, after } = config;

        before = before || [];
        after = after || [];

        if (validator) {
            const isValid = validator(params);

            if (!isValid) {
                throw { code: 400, message: ajv.errorsText(validator.errors) };
            }
        }

        const queue = [...before, { handler: originalHandler, scope }, ...after];
        let currentData = params;

        for (const { handler, scope } of queue) {
            const resultData = await handler.call(scope || null, currentData);

            if (resultData !== undefined || handler === originalHandler) {
                currentData = resultData;
            }
        }

        return currentData;
    }

    _getDefaultValidationInherits() {
        return {
            type: 'object',
            additionalProperties: false,
        };
    }

    _reportStats({ type, method, startTs, isError = false }) {
        const time = Date.now() - startTs;
        let status;

        if (isError) {
            status = 'failure';
        } else {
            status = 'success';
        }

        const labels = {
            api: method,
        };

        const metricNamePrefix = `${type}_api_${status}`;

        metrics.inc(`${metricNamePrefix}_count`, labels);
        metrics.recordTime(`${metricNamePrefix}_time`, time, labels);
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
                Logger.error('Internal route error:', error);
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
