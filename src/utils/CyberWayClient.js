const { JsonRpc, Api } = require('cyberwayjs');
const SignatureProvider = require('cyberwayjs/dist/eosjs-jssig').default;
const fetch = require('node-fetch');
const { TextEncoder, TextDecoder } = require('text-encoding');
const env = require('../data/env');

/**
 * Класс-обертка для удобной работы с блокчейном CyberWay.
 * Берет на себя инициализацию апи, достаточно лишь создать
 * экземпляр класса.
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

    /**
     * Отправляет в блокчейн указанный набор экшенов.
     * При необходимости можно задать свои параметры,
     * в том числе отключить автоматическую отправку,
     * например это нужно для бендвич-провайдера.
     * Детальное описание возможных экшенов и
     * опций можно посмотреть в документации
     * к блокчейну.
     * @param {Array} actions Набор экшенов.
     * @param {Object} options Набор опций.
     * @return {Promise<*>} Результат исполнения.
     */
    async exec(actions, options = null) {
        return await this._api.transact(
            {
                actions,
            },
            {
                options: options || {
                    broadcast: true,
                    blocksBehind: 5,
                    expireSeconds: 30,
                },
            }
        );
    }
}

module.exports = CyberWayClient;
