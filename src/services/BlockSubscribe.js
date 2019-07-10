const nats = require('node-nats-streaming');
const BasicService = require('./Basic');
const env = require('../data/env');
const Logger = require('../utils/Logger');
const ParallelUtils = require('../utils/Parallel');
const metrics = require('../utils/metrics');
const Model = require('../models/BlockSubscribe');

/**
 * Сервис подписки получения новых блоков.
 * Подписывается на рассылку блоков от CyberWay-ноды.
 * Каждый полученный блок сериализуется и передается
 * в колбек метода eachBlock, также этот метод гарантирует
 * последовательное поступление блоков, а колбек вызвается
 * через await.
 *
 * Предполагается что MongoDB была инициализирована и в неё
 * можно что-то записать и из неё что-то прочитать,
 * утилита хранит в базе свои метаданные.
 */
class BlockSubscribe extends BasicService {
    /**
     * Структура блока.
     * @typedef Block
     * @property {string} id Идентификатор блока.
     * @property {number} blockNum Номер блока.
     * @property {Date} blockTime Время блока.
     * @property {Array<Object>} transactions Транзакции в оригинальном виде.
     */

    /**
     * Оповещает о текущем номере неоткатного блока.
     * @event irreversibleBlockNum
     * @property {number} irreversibleBlockNum Номер неоткатного блока.
     */

    /**
     * В случае если очередь блокчейн-ноды уже не хранит необходимые
     * блоки будет выведено предупреждение.
     * TODO: Если нужные сообщения в nats уже исчезли надо что-то делать!
     * @param {Function} blockHandler
     *   Обработчик новых блоков, вызывается с await
     * @param {boolean} [onlyIrreversible]
     *   В случае true эвенты будут возвращать только неоткатные блоки
     * @param {boolean} [includeAllTransactions]
     *   Если не нужно отбрасывать протухшие транзакции
     * @param {string} [serverName]
     *   Имя сервера для подписки, в ином случае берется из env.
     * @param {string} [clientName]
     *   Имя клиента, предоставляемое серверу, в ином случае берется из env.
     * @param {string} [connectString]
     *   Строка подключения (с авторизацией), в ином случае берется из env.
     */
    constructor({
        onlyIrreversible = false,
        includeAllTransactions = false,
        serverName = env.GLS_BLOCKCHAIN_BROADCASTER_SERVER_NAME,
        clientName = env.GLS_BLOCKCHAIN_BROADCASTER_CLIENT_NAME,
        connectString = env.GLS_BLOCKCHAIN_BROADCASTER_CONNECT,
        blockHandler,
    } = {}) {
        super();

        this._connection = null;

        this._onConnectionConnect = this._onConnectionConnect.bind(this);
        this._onConnectionClose = this._onConnectionClose.bind(this);
        this._onConnectionError = this._onConnectionError.bind(this);

        this._onlyIrreversible = onlyIrreversible;
        this._includeAll = includeAllTransactions;
        this._serverName = serverName;
        this._clientName = clientName;
        this._connectString = connectString;

        this._blockNumTransactions = new Map();
        this._acceptedBlocksQueue = new Map();
        this._completeBlocksQueue = [];
        this._currentBlock = null;
        this._subscriber = null;
        this._lastEmittedBlockNum = null;
        this._firstSeqLogged = false;

        this._parallelUtils = new ParallelUtils();

        this._blockHandler = this._parallelUtils.consequentially(async block => {
            await this._setLastBlock(block);
            await blockHandler(block);
        });
    }

    /**
     * Запуск сервиса.
     */
    async start() {
        await this._initMetadata();
        await this._extractMetaData();
        this._connectToMessageBroker();
    }

    /**
     * Получить мета-данные последнего блока.
     * @return {{lastBlockSequence: number, lastBlockNum: number}}
     * Номер блока в очереди транслятора, номер блока в блокчейне.
     */
    async getLastBlockMetaData() {
        const model = await Model.findOne(
            {},
            {
                lastBlockNum: true,
                lastBlockSequence: true,
            },
            {
                lean: true,
            }
        );

        if (!model) {
            return {
                lastBlockNum: 0,
                lastBlockSequence: 0,
            };
        }

        return {
            lastBlockNum: model.lastBlockNum,
            lastBlockSequence: model.lastBlockSequence,
        };
    }

    /**
     * Форсированная установка мета-данных последнего блока,
     * например актуально в случае возникновения форка.
     * @param {number} lastBlockNum Номер блока в блокчейне.
     * @param {number} lastBlockSequence Номер блока в очереди транслятора.
     */
    async setLastBlockMetaData({ lastBlockNum, lastBlockSequence }) {
        const update = {};

        if (lastBlockNum !== undefined) {
            update.lastBlockNum = lastBlockNum;
        }

        if (lastBlockSequence !== undefined) {
            update.lastBlockSequence = lastBlockSequence;
        }

        if (!Object.keys(update).length) {
            Logger.warn('Last block update - empty params');
            return;
        }

        await Model.updateOne({}, { $set: update });
    }

    async _initMetadata() {
        if ((await Model.countDocuments()) === 0) {
            const model = new Model();

            await model.save();
        }
    }

    async _extractMetaData() {
        let lastBlockNum = null;
        let lastBlockSequence = 0;

        const model = await Model.findOne(
            {},
            {
                lastBlockNum: true,
                lastBlockSequence: true,
            },
            {
                lean: true,
            }
        );

        if (model) {
            lastBlockNum = model.lastBlockNum;
            lastBlockSequence = model.lastBlockSequence;
        }

        this._lastBlockNum = lastBlockNum;

        if (env.GLS_USE_ONLY_RECENT_BLOCKS) {
            this._lastProcessedSequence = null;
            this._ignoreSequencesLess = lastBlockSequence + 1;
            this._isRecentSubscribeMode = true;
        } else {
            this._lastProcessedSequence = lastBlockSequence;
            this._isRecentSubscribeMode = false;
        }
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
        const options = this._connection.subscriptionOptions();
        options.setMaxInFlight(1);

        if (this._isRecentSubscribeMode) {
            Logger.info(
                `Subscribe on blocks in recent mode, time delta: ${
                    env.GLS_RECENT_BLOCKS_TIME_DELTA
                }ms`
            );
            options.setStartAtTimeDelta(env.GLS_RECENT_BLOCKS_TIME_DELTA);
        } else {
            const seq = this._lastProcessedSequence + 1;
            Logger.info(`Subscribe on blocks, seq: ${seq}`);
            options.setStartAtSequence(seq);
        }

        this._subscribeOnEvents('Blocks', options);
    }

    _unsubscribe() {
        this._connection.removeListener('connect', this._onConnectionConnect);
        this._connection.removeListener('close', this._onConnectionClose);
        this._connection.removeListener('error', this._onConnectionError);

        this._connection.on('error', () => {
            // Вешаем пустой обработчик ошибки на отключаемое соединение,
            // чтобы случайные ошибки из соединения не убили приложение
        });

        if (this._subscriber) {
            const { subscriber, handler } = this._subscriber;
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

        this._subscriber = null;
        this._firstSeqLogged = false;
        this._connection = null;
    }

    _subscribeOnEvents(eventName, options) {
        const subscriber = this._connection.subscribe(eventName, options);

        const handlerWrapper = message => {
            let sequence;
            let data;

            try {
                sequence = message.getSequence();
                data = JSON.parse(message.getData());
            } catch (error) {
                Logger.error(`Invalid blockchain message, seq: ${sequence}`, error);
                process.exit(1);
            }

            if (!this._firstSeqLogged) {
                Logger.info(`First event received, seq: ${sequence}`);
                this._firstSeqLogged = true;
            }

            this._handleEvent(data, sequence);
        };

        subscriber.on('message', handlerWrapper);

        this._subscriber = {
            subscriber,
            handler: handlerWrapper,
        };
    }

    _handleEvent(data, sequence) {
        switch (data.msg_type) {
            case 'ApplyTrx':
                this._handleTransactionApply(data);
                return;
            case 'AcceptBlock':
                this._handleBlockAccept(data, sequence);
                return;
            case 'CommitBlock':
                this._handleBlockCommit(data);
                return;
            default:
        }
    }

    _handleTransactionApply(transaction) {
        metrics.inc('core_trx_apply');

        if (this._lastBlockNum && this._lastBlockNum >= transaction.block_num) {
            return;
        }

        let transactions = this._blockNumTransactions.get(transaction.block_num);

        if (!transactions) {
            transactions = new Map();
            this._blockNumTransactions.set(transaction.block_num, transactions);
        }

        transactions.set(transaction.id, transaction);

        if (this._currentBlock) {
            this._tryToAcceptCurrentBlock();
        }
    }

    _handleBlockAccept(block, sequence) {
        metrics.inc('core_block_accept');

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

        if (this._currentBlock) {
            Logger.info('Put block to queue', block.block_num);
            this._acceptedBlocksQueue.set(block.block_num, block);
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
            if (trxMeta.status !== 'executed' && !this._includeAll) {
                continue;
            }

            const blockNumTransactions = this._blockNumTransactions.get(block.block_num);
            const trx = blockNumTransactions ? blockNumTransactions.get(trxMeta.id) : null;

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
        this._lastBlockNum = block.block_num;

        const blockData = {
            id: block.id,
            parentId: block.previous,
            sequence: block.sequence,
            blockNum: block.block_num,
            blockTime: this._parseDate(block.block_time),
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

        this._cleanOldTransactions(block.block_num);
    }

    _checkBlockQueue() {
        const nextBlockNum = this._lastBlockNum + 1;

        if (this._acceptedBlocksQueue.has(nextBlockNum)) {
            this._setCurrentBlock(this._acceptedBlocksQueue.get(nextBlockNum));
            this._acceptedBlocksQueue.delete(nextBlockNum);

            this._tryToAcceptCurrentBlock();
        }
    }

    _setCurrentBlock(block) {
        this._currentBlock = block;

        console.log('Current block =', block.block_num);

        setTimeout(() => {
            if (this._currentBlock === block) {
                Logger.error(
                    `Transactions wait timeout reached, blockId: ${block.id} blockNum: ${
                        block.block_num
                    }`
                );

                for (const { id } of block.trxs) {
                    if (!this._blockNumTransactions.has(id)) {
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

    _handleBlockCommit(block) {
        metrics.inc('core_block_commit');

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

        this._blockHandler(block);
    }

    _cleanOldTransactions(lastProcessedBlockNum) {
        for (const blockNum of this._blockNumTransactions.keys()) {
            if (blockNum <= lastProcessedBlockNum) {
                this._blockNumTransactions.delete(blockNum);
            }
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

    async _setLastBlock(block) {
        await Model.updateOne(
            {},
            {
                $set: {
                    lastBlockNum: block.blockNum,
                    lastBlockSequence: block.sequence,
                },
            }
        );
    }
}

module.exports = BlockSubscribe;
