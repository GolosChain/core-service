const nats = require('node-nats-streaming');
const BasicService = require('./Basic');
const env = require('../data/env');
const Logger = require('../utils/Logger');
const ParallelUtils = require('../utils/Parallel');
const metrics = require('../utils/metrics');
const Model = require('../models/BlockSubscribe');

const EVENT_TYPES = {
    BLOCK: 'BLOCK',
    IRREVERSIBLE_BLOCK: 'IRREVERSIBLE_BLOCK',
    FORK: 'FORK',
};

/**
 * Сервис подписки получения новых блоков.
 * Подписывается на рассылку блоков от CyberWay-ноды.
 * Каждый полученный блок сериализуется и передается в обработчик handle,
 * также этот метод гарантирует последовательное поступление блоков.
 * Колбек вызвается через await.
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
     * В случае если очередь блокчейн-ноды уже не хранит необходимые
     * блоки будет выведена ошибка.
     * TODO: Если нужные сообщения в nats уже исчезли надо что-то делать!
     * @param {Function} handler
     *   Обработчик событий, вызывается с await.
     *   События:
     *   1. При получении очередного блока:
     *     {  type: 'BLOCK',
     *        data: <block>,
     *     }
     *   2. При получении неоткатных блоков:
     *     {  type: 'IRREVERSIBLE_BLOCK',
     *        data: <block>,
     *     }
     *   3. При возникновении форка:
     *     {  type: 'FORK',
     *        data: {
     *            baseBlockNum: <number>,
     *        }
     *     }
     * @param {string} [serverName]
     *   Имя сервера для подписки, в ином случае берется из env.
     * @param {string} [clientName]
     *   Имя клиента, предоставляемое серверу, в ином случае берется из env.
     * @param {string} [connectString]
     *   Строка подключения (с авторизацией), в ином случае берется из env.
     */
    constructor({
        serverName = env.GLS_BLOCKCHAIN_BROADCASTER_SERVER_NAME,
        clientName = env.GLS_BLOCKCHAIN_BROADCASTER_CLIENT_NAME,
        connectString = env.GLS_BLOCKCHAIN_BROADCASTER_CONNECT,
        handler,
    } = {}) {
        super();

        this._connection = null;

        this._onConnectionConnect = this._onConnectionConnect.bind(this);
        this._onConnectionClose = this._onConnectionClose.bind(this);
        this._onConnectionError = this._onConnectionError.bind(this);

        this._nastConnectParams = [serverName, clientName, { url: connectString }];

        this._subscriber = null;

        this._eventsQueue = new Map();
        this._subscribeSeq = null;
        this._processedSeq = null;
        this._blockNumTransactions = new Map();
        this._completeBlocksQueue = new Map();
        this._waitForFirstEvent = true;
        this._lastEmittedBlockNum = null;
        this._lastEmittedIrreversibleBlockNum = null;
        this._ignoreSequencesLess = null;

        this._parallelUtils = new ParallelUtils();

        this._handler = this._parallelUtils.consequentially(async event => {
            if (event.type === EVENT_TYPES.BLOCK) {
                await this._setLastBlock(event.data);
            }
            await handler(event);
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
            { lean: true }
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
     * например актуально в случае возникновения ошибки при обработке блока.
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
        const { lastBlockNum, lastBlockSequence } = await this.getLastBlockMetaData();

        this._lastBlockNum = lastBlockNum;
        this._lastEmittedBlockNum = lastBlockNum;

        if (env.GLS_USE_ONLY_RECENT_BLOCKS) {
            this._lastProcessedSequence = null;
            this._ignoreSequencesLess = lastBlockSequence + 1;
            this._isRecentSubscribeMode = true;
            this._isFirstRecentBlockSkipped = false;
        } else {
            this._lastProcessedSequence = lastBlockSequence;
            this._isRecentSubscribeMode = false;
        }
    }

    _connectToMessageBroker() {
        this._connection = nats.connect(...this._nastConnectParams);

        this._connection.on('connect', this._onConnectionConnect);
        this._connection.on('close', this._onConnectionClose);
        this._connection.on('error', this._onConnectionError);
    }

    _onConnectionConnect() {
        Logger.log('Blockchain block subscriber connected.');
        this._subscribe();
    }

    _onConnectionClose() {
        this._unsubscribe();
        this._scheduleReconnect();
    }

    _onConnectionError(err) {
        if (err.code !== 'BAD_SUBJECT') {
            Logger.error('Nats error:', err.message);
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
        options.setMaxInFlight(env.GLS_NATS_MAX_IN_FLIGHT);

        if (this._isRecentSubscribeMode) {
            const delta = env.GLS_RECENT_BLOCKS_TIME_DELTA;
            Logger.info(`Subscribe on blocks in recent mode, time delta: ${delta}ms`);
            options.setStartAtTimeDelta(delta);
        } else {
            this._subscribeSeq = this._lastProcessedSequence + 1;
            Logger.info(`Subscribe on blocks, seq: ${this._subscribeSeq}`);
            options.setStartAtSequence(this._subscribeSeq);
        }

        this._subscribeOnEvents('Blocks', options);
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

            try {
                if (this._waitForFirstEvent) {
                    if (this._subscribeSeq && this._subscribeSeq !== sequence) {
                        Logger.error(
                            `Received sequence doesn't match to subscribe sequence, subscribe: ${
                                this._subscribeSeq
                            }, received: ${sequence}`
                        );
                        process.exit(1);
                    }

                    Logger.info(`First event received, seq: ${sequence}`);
                    this._waitForFirstEvent = false;
                } else if (sequence > this._processedSeq + 1) {
                    metrics.inc('core_nats_unordered_event');
                    this._eventsQueue.set(sequence, data);
                    return;
                }

                this._processedSeq = sequence;

                this._handleEvent(data, sequence);
                this._checkEventsQueue(sequence);
            } catch (err) {
                Logger.error('BlockSubscribe: Event processing failed:', err);
                process.exit(1);
            }
        };

        subscriber.on('message', handlerWrapper);

        this._subscriber = {
            subscriber,
            handler: handlerWrapper,
        };
    }

    _checkEventsQueue(sequence) {
        // Если в очереди уже есть следующие события, то применяем их.
        for (let currentSequence = sequence + 1; ; currentSequence++) {
            const eventData = this._eventsQueue.get(currentSequence);

            if (!eventData) {
                break;
            }

            this._eventsQueue.delete(currentSequence);

            this._handleEvent(eventData, currentSequence);
        }
    }

    _unsubscribe() {
        this._connection.removeListener('connect', this._onConnectionConnect);
        this._connection.removeListener('close', this._onConnectionClose);
        this._connection.removeListener('error', this._onConnectionError);

        // Вешаем пустой обработчик ошибки на отключаемое соединение,
        // чтобы случайные ошибки из закрываемого соединения не убили приложение.
        this._connection.on('error', () => {});

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
        this._waitForFirstEvent = true;
        this._processedSeq = null;
        this._subscribeSeq = null;
        this._connection = null;
    }

    _handleEvent(data, sequence) {
        if (this._ignoreSequencesLess && sequence < this._ignoreSequencesLess) {
            return;
        }

        if (env.GLS_USE_ONLY_RECENT_BLOCKS && !this._isFirstRecentBlockSkipped) {
            if (data.msg_type === 'AcceptBlock') {
                this._isFirstRecentBlockSkipped = true;
            }
            return;
        }

        switch (data.msg_type) {
            case 'ApplyTrx':
                this._handleTransactionApply(data);
                break;
            case 'AcceptBlock':
                this._handleBlockAccept(data, sequence);
                break;
            case 'CommitBlock':
                this._handleBlockCommit(data);
                break;
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
    }

    _handleBlockAccept(block, sequence) {
        metrics.inc('core_block_accept');

        if (env.GLS_USE_ONLY_RECENT_BLOCKS) {
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

        block.sequence = sequence;

        this._finalizeBlock(block);
    }

    _extractTransactions(block) {
        const transactions = [];
        const counters = {
            executed: 0,
        };

        for (const trxMeta of block.trxs) {
            counters[trxMeta.status] = (counters[trxMeta.status] || 0) + 1;

            if (trxMeta.status !== 'executed') {
                continue;
            }

            const blockNumTransactions = this._blockNumTransactions.get(block.block_num);
            const trx = blockNumTransactions ? blockNumTransactions.get(trxMeta.id) : null;

            if (!trx) {
                Logger.error(`Transaction (${trxMeta.id}) is not found in ApplyTrx feed`);
                process.exit(1);
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
            counters,
        };
    }

    _finalizeBlock(block) {
        const { transactions, counters } = this._extractTransactions(block);

        this._lastBlockNum = block.block_num;

        const blockData = {
            id: block.id,
            parentId: block.previous,
            sequence: block.sequence,
            blockNum: block.block_num,
            blockTime: this._parseDate(block.block_time),
            transactions,
            counters,
        };

        this._emitBlock(blockData);
        this._completeBlocksQueue.set(blockData.blockNum, blockData);
        this._processIrreversibleBlocks();

        this._isRecentSubscribeMode = false;
        this._lastProcessedSequence = block.sequence;

        this._cleanOldTransactions(block.block_num);
    }

    _handleBlockCommit(block) {
        metrics.inc('core_block_commit');

        this._lastIrreversibleNum = block.block_num;

        this._processIrreversibleBlocks();
    }

    _processIrreversibleBlocks() {
        if (this._completeBlocksQueue.size === 0) {
            return;
        }

        let startBlockNum;

        if (this._lastEmittedIrreversibleBlockNum) {
            startBlockNum = this._lastEmittedIrreversibleBlockNum + 1;
        } else {
            startBlockNum = Math.min(...this._completeBlocksQueue.keys());
        }

        for (let blockNum = startBlockNum; blockNum <= this._lastIrreversibleNum; blockNum++) {
            const block = this._completeBlocksQueue.get(blockNum);

            if (!block) {
                Logger.error(
                    `Irreversible block (${blockNum}) is not found in queue, irreversible block num: ${
                        this._lastIrreversibleNum
                    }`
                );
                process.exit(1);
            }

            this._completeBlocksQueue.delete(blockNum);

            this._handler({
                type: EVENT_TYPES.IRREVERSIBLE_BLOCK,
                data: block,
            });

            this._lastEmittedIrreversibleBlockNum = block.blockNum;
        }
    }

    _emitBlock(block) {
        if (this._lastEmittedBlockNum && block.blockNum <= this._lastEmittedBlockNum) {
            this._handler({
                type: EVENT_TYPES.FORK,
                data: {
                    baseBlockNum: block.blockNum - 1,
                },
            });
        }

        metrics.inc('core_block_received');

        this._handler({
            type: EVENT_TYPES.BLOCK,
            data: block,
        });

        this._lastEmittedBlockNum = block.blockNum;
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

        // Правим некорректный формат дат
        // "2019-06-13T19:31:13.838" (без тайм-зоны) в
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

BlockSubscribe.EVENT_TYPES = EVENT_TYPES;

module.exports = BlockSubscribe;
