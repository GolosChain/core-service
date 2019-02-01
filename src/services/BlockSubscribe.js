const sleep = require('then-sleep');
const nats = require('node-nats-streaming');
const BasicService = require('./Basic');
const env = require('../data/env');
const Logger = require('../utils/Logger');

/**
 * Сервис подписки получения новых блоков.
 * Подписывается на рассылку блоков от CyberWay-ноды.
 * Каждый полученный блок сериализуется и передается
 * в эвенте 'block', а в случае форка вызывается эвент 'fork'.
 */
class BlockSubscribe extends BasicService {
    constructor(startFromBlock) {
        super();

        this._startFromBlock = startFromBlock;
        this._messageQueue = [];
        this._pendingTransactionsBuffer = new Map();
        this._connection = null;
    }

    async start() {
        this._connectToMessageBroker();
        this._makeBlockHandlers();
        this._restoreMissed();
        this._startNotifier().catch(error => {
            Logger.error(`Block notifier error - ${error}`);
            process.exit(1);
        });
    }

    _connectToMessageBroker() {
        this._connection = nats.connect(
            env.GLS_BLOCKCHAIN_BROADCASTER_SERVER_NAME,
            env.GLS_BLOCKCHAIN_BROADCASTER_CLIENT_NAME,
            env.GLS_BLOCKCHAIN_BROADCASTER_CONNECT
        );
    }

    _makeBlockHandlers() {
        this._connection.on('connect', () => {
            this._makeMessageHandler('ApplyTrx', this._handleTransactionApply.bind(this));
            this._makeMessageHandler('AcceptBlock', this._handleBlockAccept.bind(this));
        });
        this._connection.on('close', () => {
            Logger.error('Blockchain block broadcaster connection failed');
            process.exit(1);
        });
    }

    async _handleTransactionApply() {
        try {
            // TODO -
        } catch (error) {
            // TODO -
        }
    }

    async _handleBlockAccept() {
        try {
            // TODO -
        } catch (error) {
            // TODO -
        }
    }

    _makeMessageHandler(type, callback) {
        const opts = this._connection.subscriptionOptions().setStartWithLastReceived();
        const subscription = this._connection.subscribe(type, opts);

        subscription.on('message', callback);
    }

    _restoreMissed() {
        // TODO -
    }

    async _startNotifier() {
        while (true) {
            await this._notifyByQueue();
            await sleep(0);
        }
    }

    async _notifyByQueue() {
        let item;

        while ((item = this._blockQueue.shift())) {
            await this._notifyByItem(item);
        }
    }

    async _notifyByItem(item) {
        // TODO -
    }
}

module.exports = BlockSubscribe;
