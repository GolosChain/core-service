const nats = require('node-nats-streaming');
const BasicService = require('./Basic');
const env = require('../data/env');
const Logger = require('../utils/Logger');
const ParallelUtils = require('../utils/Parallel');
const metrics = require('../utils/metrics');

const RECENT_BLOCKS_TIME_DELTA = 10 * 60 * 1000;

// TODO Fork management
/**
 * Сервис подписки получения новых блоков.
 * Подписывается на рассылку блоков от CyberWay-ноды.
 * Каждый полученный блок сериализуется и передается
 * в эвенте 'block', а в случае форка вызывается эвент 'fork'.
 * Для работы с генезис-блоком предоставлен специальный
 * эвент 'genesisData'.
 *
 * Текущая версия не поддерживает 'fork'!
 */
class BlockSubscribe extends BasicService {
    /**
     * В случае если очередь блокчейн-ноды уже не хранит необходимые
     * блоки будет выведено предупреждение.
     * TODO: Если нужные сообщения в nats уже исчезли надо что-то делать!
     * @param {number} lastSequence
     *   Номер сообщения в nats, с которого нужно начать обработку.
     * @param {Date|string} lastTime
     *   Дата последней успешной обработки, с которого нужно начать обработку.
     * @param {boolean} [onlyIrreversible]
     *   В случае true эвенты будут возвращать только неоткатные блоки
     * @param {boolean} [includeExpiredTransactions]
     *   Если не нужно отбрасывать протухшие транзакции
     * @param {string} [serverName]
     *   Имя сервера для подписки, в ином случае берется из env.
     * @param {string} [clientName]
     *   Имя клиента, предоставляемое серверу, в ином случае берется из env.
     * @param {string} [connectString]
     *   Строка подключения (с авторизацией), в ином случае берется из env.
     */
    constructor({
        lastSequence = 0,
        lastTime = null,
        onlyIrreversible = false,
        includeExpiredTransactions = false,
        serverName = env.GLS_BLOCKCHAIN_BROADCASTER_SERVER_NAME,
        clientName = env.GLS_BLOCKCHAIN_BROADCASTER_CLIENT_NAME,
        connectString = env.GLS_BLOCKCHAIN_BROADCASTER_CONNECT,
    } = {}) {
        super();

        this._connection = null;

        this._onConnectionConnect = this._onConnectionConnect.bind(this);
        this._onConnectionClose = this._onConnectionClose.bind(this);
        this._onConnectionError = this._onConnectionError.bind(this);

        if (env.GLS_USE_ONLY_RECENT_BLOCKS) {
            this._lastProcessedSequence = null;
            this._ignoreSequencesLess = (lastSequence || 0) + 1;
            this._isRecentSubscribeMode = true;
        } else {
            this._lastProcessedSequence = lastSequence || 0;
            this._isRecentSubscribeMode = false;
        }

        this._lastBlockTime = lastTime;
        this._onlyIrreversible = onlyIrreversible;
        this._includeExpired = includeExpiredTransactions;
        this._serverName = serverName;
        this._clientName = clientName;
        this._connectString = connectString;

        this._transactions = new Map();
        this._recentTransactions = new Set();
        this._oldTransactions = new Set();
        this._acceptedBlocksQueue = new Map();
        this._completeBlocksQueue = [];
        this._currentBlock = null;
        this._subscribers = {};
        this._lastEmittedBlockNum = null;

        this._parallelUtils = new ParallelUtils();
    }

    /**
     * Вызывается в случае получения нового блока из блокчейна.
     * @event block
     * @property {Object} block Блок из блокчейна.
     * @property {string} block.id Идентификатор блока.
     * @property {number} block.blockNum Номер блока.
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
     * Оповещает об текущем номере неоткатного блока.
     * @event irreversibleBlockNum
     * @property {number} irreversibleBlockNum Номер неоткатного блока.
     */

    /**
     * Запуск сервиса.
     * @async
     */
    async start() {
        this._connectToMessageBroker();
        this._startCleaners();
    }

    /**
     * Вызовет переданную функцию на каждый блок, полученный из блокчейна,
     * при этом дождавшись её выполнения используя await.
     * Аргументы для функции аналогичны эвенту block.
     * @param {function} callback Обработчик.
     */
    eachBlock(callback) {
        this.on('block', this._parallelUtils.consequentially(callback));
    }

    _connectToMessageBroker() {
        this._connection = nats.connect(
            this._serverName,
            this._clientName,
            {
                url: this._connectString,
            }
        );

        this._connection.on('connect', this._onConnectionConnect);
        this._connection.on('close', this._onConnectionClose);
        this._connection.on('error', this._onConnectionError);
    }

    _onConnectionConnect() {
        Logger.log('Blockchain block broadcaster connected.');
        this._subscribe();
    }

    _onConnectionClose() {
        this._unsubscribe();
        this._scheduleReconnect();
    }

    _onConnectionError(err) {
        if (err.code !== 'BAD_SUBJECT') {
            Logger.error('Nats "error" event:', err);
        }

        this._unsubscribe();
        this._scheduleReconnect();
    }

    _scheduleReconnect() {
        Logger.warn('Blockchain block broadcaster connection closed, reconnect scheduled.');

        setTimeout(() => {
            this._connectToMessageBroker();
        }, 5000);
    }

    _subscribe() {
        this._subscribeApplyTrx();
        this._subscribeAcceptBlock();
        this._subscribeCommitBlock();
    }

    _unsubscribe() {
        this._connection.removeListener('connect', this._onConnectionConnect);
        this._connection.removeListener('close', this._onConnectionClose);
        this._connection.removeListener('error', this._onConnectionError);

        this._connection.on('error', () => {
            // Вешаем пустой обработчик ошибки на отключаемое соединение,
            // чтобы случайные ошибки из соединения не убили приложение
        });

        for (const { subscriber, handler } of Object.values(this._subscribers)) {
            subscriber.removeListener('message', handler);

            try {
                subscriber.unsubscribe();
            } catch {
                // Do nothing
            }
        }

        try {
            this._connection.close();
        } catch (err) {}

        this._subscribers = {};
        this._connection = null;
    }

    _subscribeAcceptBlock() {
        const options = this._connection.subscriptionOptions();
        options.setMaxInFlight(1);

        if (this._isRecentSubscribeMode) {
            options.setStartAtTimeDelta(RECENT_BLOCKS_TIME_DELTA);
        } else {
            options.setStartAtSequence(this._lastProcessedSequence + 1);
        }

        this._subscribeOnEvents(
            'AcceptBlock',
            options,
            'core_block_accept',
            this._handleBlockAccept
        );
    }

    _subscribeApplyTrx() {
        const options = this._connection.subscriptionOptions();
        options.setMaxInFlight(1);

        if (this._isRecentSubscribeMode) {
            // Для транзакций ставим интервал с двухкратным запасом,
            // чтобы скачались все транзакции нужные для первого блока
            options.setStartAtTimeDelta(RECENT_BLOCKS_TIME_DELTA + env.GLS_HOLD_TRANSACTIONS_TIME);
        } else {
            if (this._lastBlockTime) {
                const startTime = new Date(this._lastBlockTime);
                startTime.setMinutes(startTime.getMinutes() - 30);
                options.setStartTime(startTime);
            } else {
                options.setDeliverAllAvailable();
            }
        }

        this._subscribeOnEvents(
            'ApplyTrx',
            options,
            'core_trx_apply',
            this._handleTransactionApply
        );
    }

    _subscribeCommitBlock() {
        const options = this._connection.subscriptionOptions();
        options.setMaxInFlight(1);
        options.setStartWithLastReceived();

        this._subscribeOnEvents(
            'CommitBlock',
            options,
            'core_block_commit',
            this._handleBlockCommit
        );
    }

    _subscribeOnEvents(eventName, options, metricName, handler) {
        const subscriber = this._connection.subscribe(eventName, options);

        const handlerWrapper = message => {
            const data = this._parseMessageData(message);
            handler.call(this, data);
            metrics.inc(metricName);
        };

        subscriber.on('message', handlerWrapper);

        this._subscribers[eventName] = {
            subscriber,
            handler: handlerWrapper,
        };
    }

    _handleTransactionApply({ data: transaction }) {
        this._recentTransactions.add(transaction.id);
        this._transactions.set(transaction.id, transaction);

        if (this._currentBlock) {
            this._tryToAcceptCurrentBlock();
        }
    }

    _handleBlockAccept({ data: block, sequence }) {
        if (env.GLS_USE_ONLY_RECENT_BLOCKS) {
            if (sequence < this._ignoreSequencesLess) {
                return;
            }

            if (this._lastProcessedSequence === null) {
                this._lastProcessedSequence = sequence - 1;
            }
        }

        if (sequence <= this._lastProcessedSequence) {
            if (!env.GLS_USE_ONLY_RECENT_BLOCKS) {
                Logger.warn('Received message with sequence less or equal than already processed.');
                Logger.warn(
                    `Last processed: ${this._lastProcessedSequence}, received sequence: ${sequence}`
                );
            }
            return;
        }

        if (!block.validated) {
            return;
        }

        block.sequence = sequence;

        if (this._lastProcessedSequence && this._lastProcessedSequence + 1 !== sequence) {
            this._acceptedBlocksQueue.set(sequence, block);
            return;
        }

        this._setCurrentBlock(block);

        this._tryToAcceptCurrentBlock();
    }

    _tryToAcceptCurrentBlock({ skipMissedTransactions = false } = {}) {
        const block = this._currentBlock;

        const { transactions, isAll } = this._extractTransactions({
            skipMissedTransactions,
        });

        if (!isAll) {
            return;
        }

        this._finalizeBlock(block, transactions);

        this._checkBlockQueue();
    }

    _extractTransactions({ skipMissedTransactions }) {
        const block = this._currentBlock;
        const transactions = [];

        for (const trxMeta of block.trxs) {
            const trx = this._transactions.get(trxMeta.id);

            if (!this._includeExpired && trxMeta.status === 'expired') {
                continue;
            }

            // Если нет нужной транзакции, то прекращаем обработку, и при каждой
            // новой транзакции проверяем снова весь список.
            if (!trx) {
                if (skipMissedTransactions) {
                    continue;
                }

                return {
                    isAll: false,
                };
            }

            const stats = { ...trxMeta };
            delete stats.id;
            delete stats.status;

            transactions.push({
                id: trx.id,
                actions: trx.actions,
                status: trxMeta.status,
                stats,
            });
        }

        return {
            transactions,
            isAll: true,
        };
    }

    _finalizeBlock(block, transactions) {
        for (const { id } of transactions) {
            this._transactions.delete(id);
        }

        const blockTime = this._parseDate(block.block_time);

        this._lastBlockTime = blockTime;

        const blockData = {
            id: block.id,
            parentId: block.previous,
            sequence: block.sequence,
            blockNum: block.block_num,
            blockTime,
            transactions,
        };

        if (this._onlyIrreversible) {
            this._completeBlocksQueue.push(blockData);
            this._processIrreversibleBlocks();
        } else {
            this._emitBlock(blockData);
        }

        this._isRecentSubscribeMode = false;
        this._currentBlock = null;
        this._lastProcessedSequence = block.sequence;
    }

    _checkBlockQueue() {
        const nextSequence = this._lastProcessedSequence + 1;

        if (this._acceptedBlocksQueue.has(nextSequence)) {
            this._setCurrentBlock(this._acceptedBlocksQueue.get(nextSequence));
            this._acceptedBlocksQueue.delete(nextSequence);

            this._tryToAcceptCurrentBlock();
        }
    }

    _setCurrentBlock(block) {
        this._currentBlock = block;

        setTimeout(() => {
            if (this._currentBlock === block) {
                Logger.error(
                    `Transactions wait timeout reached, blockId: ${block.id} blockNum: ${
                        block.block_num
                    }`
                );

                for (const { id } of block.trxs) {
                    if (!this._transactions.has(id)) {
                        Logger.error(`Missed transaction: ${id}`);
                    }
                }

                if (env.GLS_ALLOW_TRANSACTION_MISS) {
                    this._tryToAcceptCurrentBlock({ skipMissedTransactions: true });
                } else {
                    process.exit(1);
                }
            }
        }, env.GLS_WAIT_FOR_TRANSACTION_TIMEOUT);
    }

    _handleBlockCommit({ data: block }) {
        const { block_num: irreversibleNum } = block;

        this._lastIrreversibleNum = irreversibleNum;

        this.emit('irreversibleBlockNum', irreversibleNum);

        if (this._onlyIrreversible) {
            this._processIrreversibleBlocks();
        }
    }

    _processIrreversibleBlocks() {
        while (this._completeBlocksQueue.length) {
            const block = this._completeBlocksQueue[0];

            if (block.blockNum <= this._lastIrreversibleNum) {
                this._completeBlocksQueue.shift();
                this._emitBlock(block);
            } else {
                // Дальше идти нет смысла, потому что в массиве блоки упорядочены по blockNum
                break;
            }
        }
    }

    _emitBlock(block) {
        if (this._lastEmittedBlockNum && block.blockNum !== this._lastEmittedBlockNum + 1) {
            Logger.error('Unordered blocks emitting!');
            Logger.error(
                `Previous blockNum: ${this._lastEmittedBlockNum}, current blockNum: ${
                    block.blockNum
                }`
            );
            process.exit(1);
        }

        metrics.inc('core_block_received');
        this.emit('block', block);
    }

    _parseMessageData(message) {
        try {
            return {
                sequence: message.getSequence(),
                data: JSON.parse(message.getData()),
            };
        } catch (error) {
            Logger.error('Invalid blockchain message:', error);
            process.exit(1);
        }
    }

    _startCleaners() {
        setInterval(() => {
            this._removeOldTransactions();
        }, env.GLS_HOLD_TRANSACTIONS_TIME);
    }

    _removeOldTransactions() {
        const removeIds = this._oldTransactions;
        this._oldTransactions = this._recentTransactions;
        this._recentTransactions = new Set();

        for (const id of removeIds) {
            this._transactions.delete(id);
        }
    }

    _parseDate(dateString) {
        let time = dateString;

        // Convert invalid format
        // "2019-06-13T19:31:13.838" (without time zone) into
        // "2019-06-13T19:31:13.838Z"
        if (time.length === 23) {
            time += 'Z';
        }

        return new Date(time);
    }
}

module.exports = BlockSubscribe;
