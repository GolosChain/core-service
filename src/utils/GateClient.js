const WebSocket = require('ws');
const EventEmitter = require('events');
const jayson = require('jayson');
const random = require('random');
const ecc = require('eosjs-ecc');
const Logger = require('./Logger');

/**
 * Утилита для работы с гейт-сервисом или другим совместимым сервисом.
 * Использует JSON-RPC поверх WebSocket.
 * Включено логгирование всех входящих запросов.
 */
class GateClient {
    /**
     * @param {string} connectString Строка подключения к гейту.
     */
    constructor(connectString) {
        this._connectString = connectString;
        this._emitter = new EventEmitter();
    }

    /**
     * Запускает подключение к сокетам и получение входящих данных.
     * @return {Promise<null>} Пустрой промис.
     */
    async start() {
        return new Promise(resolve => {
            this._client = new WebSocket(this._connectString);
            this._client.on('open', resolve);
            this._client.on('message', this._handleMessage.bind(this));
        });
    }

    /**
     * Производит стандартную операцию авторизации в CyberWay.
     * @param {string} userId Идентификатор пользователя.
     * @param {string} privateKey Приватный ключ пользователя,
     * ключ не передается на сервер.
     * @return {Promise<Object>} Ответ авторизации.
     */
    async auth(userId, privateKey) {
        const secretData = await this.send('auth.generateSecret');

        if (secretData.error) {
            throw secretData.error;
        }

        const secret = secretData.result.secret;
        const secretBuffer = Buffer.from(secret);
        const sign = ecc.Signature.sign(secretBuffer, privateKey).toString();

        return await this.send('auth.authorize', { user: userId, sign, secret });
    }

    /**
     * Отправка запроса.
     * @param {string} point RPC-метод.
     * @param {Object} [data] Передаваемые данные, опционально.
     * @param {Number} [id] Идентификатор запроса, если не указан - генерируется случайно.
     * @return {Promise<Object>} Ответ из гейта.
     */
    async send(point, data = {}, id) {
        if (!id) {
            id = this._makeId();
        }

        return new Promise(resolve => {
            this._emitter.once(`message-id${id}`, result => {
                resolve(result);
            });
            this.sendRaw(point, data, id);
        });
    }

    /**
     * Непосредственная отправка JSON-RPC запроса по сокету.
     * Не возвращает результата.
     * @param {string} point RPC-метод.
     * @param {Object} data Передаваемые данные.
     * @param {string} id Идентификатор запроса, в случае отсутствия
     * будет идентифицированно как RPC-нотификация без ожидания ответа.
     */
    sendRaw(point, data, id) {
        this._client.send(JSON.stringify(jayson.utils.request(point, data, id)));
    }

    _handleMessage(message) {
        message = JSON.parse(message);

        if (message.result) {
            this._logResponse(message, 'info');
            this._notify(message);
        } else if (message.error) {
            this._logResponse(message, 'error');
            this._notify(message);
        } else if (message.method === 'sign') {
            Logger.log(`Secret notify - ${message.params.secret}`);
        } else {
            Logger.warn(`Unknown data format - ${JSON.stringify(message)}`);
            throw { code: 1, message: 'Unknown data format' };
        }
    }

    _logResponse(message, type) {
        let data;

        if (type === 'error') {
            data = message.error;
        } else {
            data = message.result;
        }

        Logger[type](`${message.id} - ${JSON.stringify(data)}`);
    }

    _notify(message) {
        this._emitter.emit(`message-id${message.id}`, message);
    }

    _makeId() {
        return random.int(100, 999);
    }
}

module.exports = GateClient;
