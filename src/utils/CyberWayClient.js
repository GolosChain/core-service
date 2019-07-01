const { JsonRpc, Api } = require('cyberwayjs');
const SignatureProvider = require('cyberwayjs/dist/eosjs-jssig').default;
const fetch = require('node-fetch');
const { TextEncoder, TextDecoder } = require('text-encoding');
const env = require('../data/env');

/**
 * Класс-обертка для удобной работы с блокчейном CyberWay.
 * Берет на себя инициализацию апи, достаточно лишь создать
 * экземпляр класса и вызвать getClient для получения уже
 * настроенного объекта api библиотеки cyberwayjs.
 * При необходимости в конструктор можно передать ключи
 * для SignatureProvider, необходимые, например, для
 * регистрации новых пользователей.
 */
class CyberWayClient {
    /**
     * @param {Array<string>} signatureKeys Массив строк ключей для SignatureProvider.
     */
    constructor(signatureKeys = null) {
        const rpc = new JsonRpc(env.GLS_CYBERWAY_CONNECT, { fetch });
        let signatureProvider = null;

        if (Array.isArray(signatureKeys)) {
            signatureProvider = new SignatureProvider(signatureKeys);
        }

        this._api = new Api({
            rpc,
            signatureProvider,
            textDecoder: new TextDecoder(),
            textEncoder: new TextEncoder(),
        });
    }

    /**
     * Получить настроенный объект api блокчейна.
     * @return {Api} Настроенный объект.
     */
    getClient() {
        return this._api;
    }
}

module.exports = CyberWayClient;
