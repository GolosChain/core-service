const sleep = require('then-sleep');
const nats = require('node-nats-streaming');
const BasicService = require('./Basic');
const env = require('../data/env');
const Logger = require('../utils/Logger');

// TODO Fork management
// TODO Clean pending transactions buffer
// TODO Start from block where no empty transactions
/**
 * Сервис подписки получения новых блоков.
 * Подписывается на рассылку блоков от CyberWay-ноды.
 * Каждый полученный блок сериализуется и передается
 * в эвенте 'block', а в случае форка вызывается эвент 'fork'.
 *
 * Текущая версия не поддерживает 'fork'!
 */
class BlockSubscribe extends BasicService {
    constructor(startFromBlock = 0) {
        super();

        this._startFromBlock = startFromBlock;
        this._blockQueue = [];
        this._pendingTransactionsBuffer = new Map();
        this._handledBlocksBuffer = new Map();
        this._connection = null;
        this._currentBlockNum = Infinity;
    }

    /**
     * Вызывается в случае получения нового блока из блокчейна.
     * @event block
     * @property {Object} block Блок из блокчейна.
     * @property {string} block.id Идентификатор блока.
     * @property {Number} block.blockNum Номер блока.
     * @property {Date} block.blockTime Время блока.
     * @property {Array<Object>} block.transactions Транзакции в оригинальном виде.
     */

    /**
     * Не работает в текущей версии!
     *
     * Вызывается в случае обнаружения форка, оповещает о номере блока,
     * с которого начинаются расхождения.
     * После этого эвента подписчик прекращает свою работу.
     * @event fork
     */

    /**
     * Запуск сервиса.
     * Предполагается что слушатели на эвенты установлены до запуска.
     * @returns {Promise<void>} Промис без экстра данных.
     */
    async start() {
        this._connectToMessageBroker();
        this._makeBlockHandlers();
        this._makeCleaners();
        this._startNotifier().catch(error => {
            Logger.error(`Block notifier error - ${error.stack}`);
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

    async _handleTransactionApply(transaction) {
        try {
            transaction.actions = transaction.actions.filter(action => action.data === '');

            this._pendingTransactionsBuffer.set(transaction.id, transaction);
        } catch (error) {
            Logger.error(`Handle transaction error - ${error.stack}`);
            process.exit(1);
        }
    }

    async _handleBlockAccept(block) {
        if (!block.validated || this._handledBlocksBuffer.has(block.id)) {
            return;
        }

        try {
            const transactions = [];

            this._currentBlockNum = block.block_num;

            for (const { id } of block.trxs) {
                transactions.push(this._pendingTransactionsBuffer.get(id));
                this._pendingTransactionsBuffer.delete(id);
            }

            this._blockQueue.push({
                id: block.id,
                blockNum: block.block_num,
                blockTime: new Date(block.block_time),
                transactions,
            });

            this._handledBlocksBuffer.set(block.id, block.block_num);
        } catch (error) {
            Logger.error(`Handle block error - ${error.stack}`);
            process.exit(1);
        }
    }

    _makeMessageHandler(type, callback) {
        const delta = env.GLS_BLOCK_SUBSCRIBER_REPLAY_TIME_DELTA;
        const opts = this._connection
            .subscriptionOptions()
            .setStartWithLastReceived()
            .setStartAtTimeDelta(delta);
        const subscription = this._connection.subscribe(type, opts);

        subscription.on('message', message => callback.call(this, this._parseMessageData(message)));
    }

    _parseMessageData(message) {
        try {
            return JSON.parse(message.getData());
        } catch (error) {
            Logger.error(`Invalid blockchain message - ${error.stack}`);
            process.exit(1);
        }
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

    async _notifyByItem(block) {
        if (block.blockNum >= this._startFromBlock) {
            this.emit('block', block);
        }
    }

    _makeCleaners() {
        const interval = env.GLS_BLOCK_SUBSCRIBER_CLEANER_INTERVAL;

        setInterval(() => {
            this._removeOldDuplicateBlockFilters().catch(error => {
                Logger.error(`Cant remove old dup block filters - ${error.stack}`);
                process.exit(1);
            });
        }, interval);
    }

    async _removeOldDuplicateBlockFilters() {
        const lastBlockStore = env.GLS_BLOCK_SUBSCRIBER_LAST_BLOCK_STORE;

        for (const [id, blockNum] of this._handledBlocksBuffer) {
            if (blockNum < this._currentBlockNum - lastBlockStore) {
                this._handledBlocksBuffer.delete(id);
            }
            await sleep(0);
        }
    }
}

module.exports = BlockSubscribe;
