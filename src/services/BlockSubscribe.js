const path = require('path');
const child = require('child_process');
const nats = require('node-nats-streaming');
const fetch = require('node-fetch');
const Service = require('./Service');
const env = require('../data/env');
const globalData = require('../data/data');
const Logger = require('../utils/Logger');
const ParallelUtils = require('../utils/Parallel');
const metrics = require('../utils/metrics');
const Model = require('../models/BlockSubscribe');

const EVENT_TYPES = {
    BLOCK: 'BLOCK',
    IRREVERSIBLE_BLOCK: 'IRREVERSIBLE_BLOCK',
    FORK: 'FORK',
};

const CHECK_ACTIVITY_EVERY = 30 * 1000;
const RECONNECT_DELAY = 10 * 1000;
const RECONNECT_RETRY_LIMIT = 30;
const NO_MESSAGES_RECONNECT_TIMEOUT = 2 * 60 * 1000;
const NO_MESSAGES_RECONNECT_RETRY_LIMIT = 5;

/**
 * Сервис подписки получения новых блоков.
 * Подписывается на рассылку блоков от CyberWay-ноды.
 * Каждый полученный блок десериализуется и передается в обработчик handle,
 * также этот метод гарантирует последовательное поступление блоков.
 * Колбек вызвается через await.
 *
 * Предполагается что MongoDB была инициализирована и в неё
 * можно что-то записать и из неё что-то прочитать,
 * утилита хранит в базе свои метаданные.
 */
class BlockSubscribe extends Service {
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
     * @param {boolean} [captureProducers]
     *   Значение `true` расширит блок информацией о продюсере и расписаниях.
     */
    constructor({
        serverName = env.GLS_BLOCKCHAIN_BROADCASTER_SERVER_NAME,
        clientName = env.GLS_BLOCKCHAIN_BROADCASTER_CLIENT_NAME,
        natsConnect = env.GLS_BLOCKCHAIN_BROADCASTER_CONNECT,
        handler,
        captureProducers,
    } = {}) {
        super();

        this._serverName = serverName;
        this._clientName = clientName;
        this._natsConnect = natsConnect;
        this._captureProducers = Boolean(captureProducers);

        this._noMessagesReconnect = 0;

        this._resetState();

        this._onConnectionConnect = this._onConnectionConnect.bind(this);
        this._onConnectionClose = this._onConnectionClose.bind(this);
        this._onConnectionError = this._onConnectionError.bind(this);

        this._parallelUtils = new ParallelUtils();

        this._handler = this._parallelUtils.consequentially(async event => {
            if (event instanceof Function) {
                event();
                return;
            }

            switch (event.type) {
                case EVENT_TYPES.BLOCK:
                    await this._setLastBlock(event.data);
                    break;
                case EVENT_TYPES.IRREVERSIBLE_BLOCK:
                    if (event.isRealIrreversible) {
                        await this._setLastIrreversibleBlock(event.data);
                    }
                    break;
                default:
                // Do nothing
            }

            await handler(event);
        });
    }

    _resetState() {
        this._connection = null;
        this._subscriber = null;

        this._eventsQueue = new Map();
        this._subscribeSeq = null;
        this._processedSeq = null;
        this._blockNumTransactions = new Map();
        this._completeBlocksQueue = new Map();
        this._waitForFirstEvent = true;
        this._lastIrreversibleBlockNum = null;
        this._lastEmittedBlockNum = null;
        this._lastEmittedIrreversibleBlockNum = null;
        this._ignoreSequencesLess = null;
        this._subscribedAt = null;
        this._lastMessageReceivedAt = null;
        this._connectionErrors = 0;
    }

    /**
     * Запуск сервиса.
     */
    async start() {
        await super.start();

        await this._initMetadata();
        await this._extractMetaData();
        await this._validateNodeId();

        this._connectToMessageBroker();
    }

    async stop() {
        clearInterval(this._eventMonitoringInterval);

        await super.stop();
    }

    /**
     * Получить мета-данные последнего блока.
     * @return {{nodeId: string, lastBlockSequence: number, lastBlockNum: number}}
     * Номер блока в очереди транслятора, номер блока в блокчейне.
     */
    async getLastBlockMetaData() {
        const model = await Model.findOne(
            {},
            {
                nodeId: true,
                lastBlockNum: true,
                lastBlockSequence: true,
            },
            { lean: true }
        );

        if (!model) {
            return {
                nodeId: null,
                lastBlockNum: 0,
                lastBlockSequence: 0,
            };
        }

        return {
            nodeId: model.nodeId || env.DEFAULT_NATS_NODE_ID,
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

        await Model.updateOne({}, { $set: update }, { upsert: true });
    }

    async _initMetadata() {
        if ((await Model.countDocuments()) === 0) {
            const model = new Model();

            await model.save();
        }
    }

    async _updateMeta(updates) {
        await Model.updateOne({}, { $set: updates });
        Logger.info('Block subscribe meta updated:', updates);
    }

    async _extractMetaData() {
        const { nodeId, lastBlockNum, lastBlockSequence } = await this.getLastBlockMetaData();

        this._nodeId = nodeId;
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

    async _validateNodeId() {
        const firstNodeId = Object.keys(this._natsConnect)[0];

        if (!firstNodeId) {
            Logger.error('Invalid nats connections settings:', this._natsConnect);
            process.exit(1);
        }

        // If first run (no nodeId saved).
        if (!this._nodeId) {
            Logger.info('Set nats node id to:', firstNodeId);
            await this._updateMeta({
                nodeId: firstNodeId,
            });
            this._nodeId = firstNodeId;
            return;
        }

        const connectString = this._natsConnect[this._nodeId];

        if (!connectString) {
            if (!(await this._switchNode(firstNodeId))) {
                Logger.error('Critical: Node switch failed');
                process.exit(1);
            }
        }
    }

    async _switchNode(targetNodeId) {
        Logger.info('Nats node switch process is started');

        const { lastIrrBlockId, lastIrrBlockNum } = await Model.findOne(
            {},
            { lastIrrBlockId: true, lastIrrBlockNum: true },
            { lean: true }
        );

        if (lastIrrBlockId) {
            Logger.info('Irreversible block found, start switching process with data:', {
                targetNodeId,
                lastIrrBlockId,
                lastIrrBlockNum,
            });

            let seq = null;

            try {
                seq = await this._findIrreversibleBlockInNats(
                    targetNodeId,
                    lastIrrBlockId,
                    lastIrrBlockNum
                );
            } catch (err) {
                Logger.warn('findIrreversibleBlockInNats failed:', err);
                return false;
            }

            Logger.info(`Sequence on new node (${targetNodeId}) found:`, seq);

            this._handler({
                type: EVENT_TYPES.FORK,
                data: {
                    baseBlockNum: lastIrrBlockNum,
                },
            });

            await this._waitQueueEmpty();

            await this._updateMeta({
                nodeId: targetNodeId,
                lastBlockNum: lastIrrBlockNum,
                lastBlockSequence: seq,
            });
        } else {
            await this._updateMeta({
                nodeId: targetNodeId,
            });
        }

        await this._extractMetaData();

        return true;
    }

    async _findIrreversibleBlockInNats(nodeId, irrBlockId, irrBlockNum) {
        return new Promise((resolve, reject) => {
            const connectString = this._natsConnect[nodeId];

            const script = child.fork(
                path.join(__dirname, '../../scripts/nats-find-seq.js'),
                [JSON.stringify({ connectString, blockId: irrBlockId, blockNum: irrBlockNum })],
                {
                    stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
                }
            );

            const chunks = [];

            script.stdout.on('data', data => {
                chunks.push(data);
            });

            script.stderr.on('data', data => {
                Logger.error('nats-find-seq.js error:', data.toString());
            });

            script.on('exit', code => {
                if (code !== 0) {
                    Logger.error('nats-find-seq.js exited with error code:', code);
                    reject(new Error('nats-find-seq failed'));
                    return;
                }

                const result = JSON.parse(chunks.join(''));
                Logger.info('nats-find-seq.js result:', result);
                resolve(result.sequence);
            });
        });
    }

    _connectToMessageBroker() {
        const connectString = this._natsConnect[this._nodeId];

        if (!connectString) {
            Logger.error(
                `No nats connection string for node id: ${this._nodeId}:`,
                this._natsConnect
            );
            process.exit(1);
        }

        this._connection = nats.connect(this._serverName, this._clientName, { url: connectString });

        this._connection.on('connect', this._onConnectionConnect);
        this._connection.on('close', this._onConnectionClose);
        this._connection.on('error', this._onConnectionError);

        this._eventMonitoringInterval = setInterval(
            this._checkEvents.bind(this),
            CHECK_ACTIVITY_EVERY
        );
    }

    _onConnectionConnect() {
        Logger.log('Blockchain block subscriber connected.');
        this._connectionErrors = 0;
        this._subscribe();
    }

    _onConnectionClose() {
        Logger.warn('Nats connection closed');

        this._unsubscribe();
        this._scheduleReconnect();
    }

    async _onConnectionError(err) {
        Logger.error('Nats connection error:', err.message);

        this._connectionErrors++;

        if (this._connectionErrors >= RECONNECT_RETRY_LIMIT) {
            if (await this._tryToSwitchNode()) {
                return;
            }
        }

        this._unsubscribe();
        this._scheduleReconnect();
    }

    async _checkEvents() {
        const lastActivity = this._lastMessageReceivedAt || this._subscribedAt;

        if (lastActivity && lastActivity < Date.now() - NO_MESSAGES_RECONNECT_TIMEOUT) {
            if (this._noMessagesReconnect >= NO_MESSAGES_RECONNECT_RETRY_LIMIT) {
                if (await this._tryToSwitchNode()) {
                    return;
                }
            }

            this._noMessagesReconnect++;
            this._onConnectionError(new Error('Timeout: no new messages'));
        }
    }

    async _tryToSwitchNode() {
        const currentNodeId = this._nodeId;

        const targetNodeId = this._chooseNewNodeId();

        if (!targetNodeId) {
            return false;
        }

        this._unsubscribe();
        await this._waitQueueEmpty();

        if (!(await this._switchNode(targetNodeId))) {
            return false;
        }

        this._sendAlert({ currentNodeId, targetNodeId });

        this._resetState();
        await this._extractMetaData();

        this._connectToMessageBroker();

        return true;
    }

    _waitQueueEmpty() {
        return new Promise(resolve => {
            this._handler(resolve);
        });
    }

    _chooseNewNodeId() {
        const anotherNodeIds = [...Object.keys(this._natsConnect)].filter(
            nodeId => nodeId !== this._nodeId
        );

        if (!anotherNodeIds.length) {
            return null;
        }

        // Выбираем случайную ноду из оставшихся
        return anotherNodeIds[Math.floor(Math.random() * anotherNodeIds.length)];
    }

    _scheduleReconnect() {
        Logger.warn('Nats connection closed, reconnect scheduled.');

        setTimeout(() => {
            this._connectToMessageBroker();
        }, RECONNECT_DELAY);
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

            this._lastMessageReceivedAt = Date.now();
            // Сбрасываем переменную храняющую количество переподключений
            this._noMessagesReconnect = 0;

            try {
                if (this._waitForFirstEvent) {
                    if (this._subscribeSeq && this._subscribeSeq !== sequence) {
                        Logger.error(
                            `Received sequence doesn't match to subscribe sequence, subscribe: ${this._subscribeSeq}, received: ${sequence}`
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

        this._subscribedAt = Date.now();

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
        clearInterval(this._eventMonitoringInterval);

        if (this._connection) {
            this._connection.removeListener('connect', this._onConnectionConnect);
            this._connection.removeListener('close', this._onConnectionClose);
            this._connection.removeListener('error', this._onConnectionError);

            // Вешаем пустой обработчик ошибки на отключаемое соединение,
            // чтобы случайные ошибки из закрываемого соединения не убили приложение.
            this._connection.on('error', () => {});
        }

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

        if (
            this._lastIrreversibleBlockNum &&
            this._lastIrreversibleBlockNum >= transaction.block_num
        ) {
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

                if (env.GLS_SKIP_MISSING_TRANSACTIONS) {
                    continue;
                } else {
                    process.exit(1);
                }
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

        if (this._captureProducers) {
            blockData.producer = block.producer;
            blockData.schedule = block.active_schedule;
            blockData.nextSchedule = block.next_schedule;
        }

        this._emitBlock(blockData);
        this._completeBlocksQueue.set(blockData.blockNum, blockData);
        this._processIrreversibleBlocks();

        this._isRecentSubscribeMode = false;
        this._lastProcessedSequence = block.sequence;
    }

    _handleBlockCommit(block) {
        metrics.inc('core_block_commit');

        this._lastIrreversibleBlockNum = block.block_num;

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

        for (let blockNum = startBlockNum; blockNum <= this._lastIrreversibleBlockNum; blockNum++) {
            const block = this._completeBlocksQueue.get(blockNum);

            if (!block) {
                Logger.error(
                    `Irreversible block (${blockNum}) is not found in queue, irreversible block num: ${this._lastIrreversibleBlockNum}`
                );
                process.exit(1);
            }

            this._completeBlocksQueue.delete(blockNum);

            this._handler({
                type: EVENT_TYPES.IRREVERSIBLE_BLOCK,
                data: block,
                isRealIrreversible: blockNum === this._lastIrreversibleBlockNum,
            });

            this._lastEmittedIrreversibleBlockNum = block.blockNum;
        }

        this._cleanOldTransactions();
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

    _cleanOldTransactions() {
        if (!this._lastIrreversibleBlockNum) {
            return;
        }

        for (const blockNum of this._blockNumTransactions.keys()) {
            if (blockNum <= this._lastIrreversibleBlockNum) {
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

    async _setLastIrreversibleBlock(block) {
        await Model.updateOne(
            {},
            {
                $set: {
                    lastIrrBlockId: block.id,
                    lastIrrBlockNum: block.blockNum,
                },
            }
        );
    }

    async _sendAlert({ currentNodeId, targetNodeId }) {
        if (!env.GLS_SLACK_ALERT_WEB_HOOK) {
            return;
        }

        try {
            const currentNode = this._extractNodeHost(currentNodeId);
            const targetNode = this._extractNodeHost(targetNodeId);

            const data = {
                text: `Service "${globalData.serviceName || 'unknown'}"`,
                attachments: [
                    {
                        color: 'warning',
                        title: 'Nats node have been switched',
                        text: `to "${targetNode}" from "${currentNode}"`,
                        ts: Date.now(),
                    },
                ],
            };

            const response = await fetch(env.GLS_SLACK_ALERT_WEB_HOOK, {
                method: 'POST',
                mode: 'no-cors',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                throw new Error(`Request failed: ${response.status}, ${response.statusText}`);
            }
        } catch (err) {
            Logger.warn('Sending slack alert failed:', err);
        }
    }

    _extractNodeHost(nodeId) {
        if (!nodeId) {
            return 'N/A';
        }

        const connectString = this._natsConnect[nodeId] || '';

        const match = connectString.match(/^nats:\/\/[^@]+@(.+)$/);

        if (!match) {
            return `${nodeId} (address: N/A)`;
        }

        return `${nodeId}: ${match[1]}`;
    }
}

BlockSubscribe.EVENT_TYPES = EVENT_TYPES;

module.exports = BlockSubscribe;
