const { JsonRpc, Api } = require('cyberwayjs');
const JsSignatureProvider = require('cyberwayjs/dist/eosjs-jssig').default;
const fetch = require('node-fetch');
const { TextEncoder, TextDecoder } = require('text-encoding');

/**
 * Класс, реализующий регистрацию пользователя в БЧ
 */
class UserRegistration {
    /**
     * Конструктор, инициализирующий требуемую настройку для общения с БЧ
     * @param {string} blockChainConnectionString http-ендпоинт для подключения к БЧ
     * @param {string} registrarKey приватный ключ пользователя, осущетвляющего регистрацию (регистратора)
     * @param {string} creatorKey приватный ключ пользователя, осущетвляющего создание юзернейма (создателя)
     * @param {string} registrarAccount имя аккаунта-регистратора
     * @param {string} creatorAccount имя аккаунта-создателя
     */
    constructor({
        blockChainConnectionString,
        registrarKey,
        creatorKey,
        registrarAccount,
        creatorAccount,
    }) {
        if (!blockChainConnectionString) {
            throw new Error('Property "blockChainConnectionString" is required');
        }

        if (!registrarKey) {
            throw new Error('Property "registrarKey" is required');
        }

        if (!creatorKey) {
            throw new Error('Property "creatorKey" is required');
        }

        if (!registrarAccount) {
            throw new Error('Property "registrarAccount" is required');
        }

        if (!creatorAccount) {
            throw new Error('Property "creatorAccount" is required');
        }

        this._blockChainConnectionString = blockChainConnectionString;
        this._registrarKey = registrarKey;
        this._creatorKey = creatorKey;
        this._registrarAccount = registrarAccount;
        this._creatorAccount = creatorAccount;

        const rpc = new JsonRpc(this._blockChainConnectionString, { fetch });
        const signatureProvider = new JsSignatureProvider([this._registrarKey, this._creatorKey]);

        this._api = new Api({
            rpc,
            signatureProvider,
            textDecoder: new TextDecoder(),
            textEncoder: new TextEncoder(),
        });
    }

    /**
     * Регистрирует пользователя с указанными параметрами
     * @param {string} name имя аккаунта
     * @param {string} alias юзернейм аккаунта
     * @param {string} owner owner-ключ
     * @param {string} active active-ключ
     * @param {string} posting posting-ключ
     * @returns {Promise<string>} id тразакции на регистрацию
     */
    async registerUser(name, alias, { owner, active, posting }) {
        const transactionOptions = {
            providebw: true,
            broadcast: false,
            blocksBehind: 5,
            expireSeconds: 3600,
            keyProvider: [this._registrarKey],
        };
        const transaction = this._generateRegisterTransaction(name, alias, {
            owner,
            active,
            posting,
        });
        const trx = await this._api.transact(transaction, transactionOptions);
        const { transaction_id: transactionId } = await this._api.pushSignedTransaction(trx);
        return transactionId;
    }

    /**
     * Возвращает объект несериализованной транзакции регистрации
     * @param {string} name имя аккаунта
     * @param {string} alias юзернейм аккаунта
     * @param {string} owner owner-ключ
     * @param {string} active active-ключ
     * @param {string} posting posting-ключ
     * @returns {*} объект несериализованной транзакции регистрации
     * @private
     */
    _generateRegisterTransaction(name, alias, { owner, active, posting }) {
        return {
            actions: [
                {
                    account: 'cyber',
                    name: 'newaccount',
                    authorization: [
                        {
                            actor: this._creatorAccount,
                            permission: 'createuser',
                        },
                    ],
                    data: {
                        creator: this._registrarAccount,
                        name,
                        owner: this._generateAuthorityObject(owner),
                        active: this._generateAuthorityObject(active),
                        posting: this._generateAuthorityObject(posting),
                    },
                },
                {
                    account: 'cyber.domain',
                    name: 'newusername',
                    authorization: [
                        {
                            actor: this._creatorAccount,
                            permission: 'active',
                        },
                    ],
                    data: {
                        creator: this._creatorAccount,
                        name: alias,
                        owner: name,
                    },
                },
                {
                    account: 'gls.vesting',
                    name: 'open',
                    authorization: [
                        {
                            actor: this._creatorAccount,
                            permission: 'active',
                        },
                    ],
                    data: {
                        symbol: '6,GOLOS',
                        owner: name,
                        ram_payer: this._creatorAccount,
                    },
                },
            ],
        };
    }

    /**
     * Возвращает объект authority для ключа
     * @param key ключ
     * @returns {{waits: Array, keys: {weight: number, key: *}[], threshold: number, accounts: Array}}
     * @private
     */
    _generateAuthorityObject(key) {
        return { threshold: 1, keys: [{ key, weight: 1 }], accounts: [], waits: [] };
    }
}

module.exports = UserRegistration;
