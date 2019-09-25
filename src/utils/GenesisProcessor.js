const fs = require('fs');
const nats = require('node-nats-streaming');

const env = require('../data/env');
const Logger = require('../utils/Logger');
const Parallel = require('../utils/Parallel');
const metrics = require('../utils/metrics');

const RECONNECT_TIMEOUT = 5000;
const MAX_HANDLE_QUEUE_LENGTH = 4000;
const MAX_CONTROLLER_QUEUE_LENGTH = 40000;

class GenesisProcessor {
    constructor({ genesisController }) {
        this._nats = null;
        this._isConnected = false;
        this._previousReceivedType = null;
        this._processPromise = null;
        this._isDataStartReceived = false;
        this._isDataEndReceived = false;
        this._intervalMessagesReceived = 0;
        this._lastProcessedSeq = 0;
        this._isSeqLogged = false;
        this._queue = new Map();

        this._parallelUtils = new Parallel();

        this._genesisController = genesisController;

        this._onNatsConnect = this._onNatsConnect.bind(this);
        this._onNatsClose = this._onNatsClose.bind(this);
        this._onNatsError = this._onNatsError.bind(this);
        this._onMessage = this._onMessage.bind(this);

        this._backPressureCheckInterval = setInterval(this._checkQueues.bind(this), 2000);

        this._sequentialHandleData = this._parallelUtils.consequentially(async (...args) => {
            try {
                await this._handleData(...args);
            } catch (err) {
                this._sequentialHandleData.cancel();
                this._processPromise.reject(err);
            }
        });
    }

    _checkQueues() {
        if (!this._isConnected) {
            return;
        }

        const handleQueueLength = this._sequentialHandleData.getQueueLength();
        const controllerQueueLength = this._genesisController.getQueueLength();

        metrics.set('genesis_handle_queue_length', handleQueueLength);
        metrics.set('genesis_controller_queue_length', controllerQueueLength);

        if (this._isPaused) {
            // Делители 4 и 10 используются для того чтобы убрать частые переходы между состояниями активности и паузы.
            // Суть такая, что если убрать эти делители, то при колебаниях показателей около границ будут происходить
            // частые остановки и восстановления, так как показатели handleQueueLength и controllerQueueLength часто
            // меняются. При использовании делителей, подписка будет восстановлена только при существенном уменьшении
            // очередей. Показатели 4 и 10 были выбраны имперически.
            if (
                handleQueueLength < MAX_HANDLE_QUEUE_LENGTH / 4 &&
                controllerQueueLength < MAX_CONTROLLER_QUEUE_LENGTH / 10
            ) {
                Logger.info('Resuming');
                this._startSubscription();
            }
        } else {
            if (
                handleQueueLength > MAX_HANDLE_QUEUE_LENGTH ||
                controllerQueueLength > MAX_CONTROLLER_QUEUE_LENGTH
            ) {
                Logger.info('Pausing because of', { handleQueueLength, controllerQueueLength });
                this._stopSubscription();
            }
        }
    }

    async process() {
        Logger.info('Genesis applying process is started');

        await this._connect();
        this._subscribe();

        await new Promise((resolve, reject) => {
            this._processPromise = {
                resolve,
                reject,
            };
        });

        try {
            this._resetNatsConnection();
        } catch {}

        clearInterval(this._backPressureCheckInterval);

        Logger.info('Genesis applying process is finished');
    }

    async _connect() {
        return new Promise((resolve, reject) => {
            this._connectingPromise = {
                resolve,
                reject,
            };

            this._nats = nats.connect(
                env.GLS_BLOCKCHAIN_BROADCASTER_SERVER_NAME,
                env.GLS_BLOCKCHAIN_BROADCASTER_CLIENT_NAME + '-genesis',
                {
                    url: env.GLS_BLOCKCHAIN_BROADCASTER_CONNECT,
                }
            );

            this._nats.on('connect', this._onNatsConnect);
            this._nats.on('close', this._onNatsClose);
            this._nats.on('error', this._onNatsError);
        });
    }

    _resetNatsConnection() {
        this._nats.removeListener('connect', this._onNatsConnect);
        this._nats.removeListener('close', this._onNatsClose);
        this._nats.removeListener('error', this._onNatsError);

        // Игнорируем все дальнейшие ошибки, так как уже устанавливаем новое соединение
        this._nats.on('error', () => {});

        try {
            this._closeSubscription();
        } catch (err) {
            // Do nothing
        }

        try {
            this._nats.close();
        } catch (err) {
            // Do nothing
        }

        this._nats = null;
        this._isSeqLogged = false;
    }

    _closeSubscription() {
        this._subscription.removeListener('message', this._onMessage);
        this._subscription.removeListener('error', this._onNatsError);

        if (!this._subscription.isClosed) {
            this._subscription.close();
        }

        this._subscription = null;
    }

    _onNatsConnect() {
        Logger.info('Nats connected');
        this._isConnected = true;
        this._connectingPromise.resolve();
    }

    _onNatsClose() {
        this._resetAndReconnect();
    }

    _onNatsError(err) {
        Logger.error('Nats error:', err.message);
        this._connectingPromise.reject(err);
        this._resetAndReconnect();
    }

    _resetAndReconnect() {
        this._isConnected = false;
        this._isPaused = false;

        this._resetNatsConnection();
        this._scheduleNatsReconnect();
    }

    _scheduleNatsReconnect() {
        setTimeout(async () => {
            Logger.info('Nats reconnecting');
            try {
                await this._connect();
                this._subscribe();
            } catch {
                // В случае ошибки ничего делать не надо, реконнект начнется автоматически
            }
        }, RECONNECT_TIMEOUT);
    }

    _subscribe() {
        const options = this._nats.subscriptionOptions();

        Logger.log(`Subscribe on seq: ${this._lastProcessedSeq + 1}`);
        options.setMaxInFlight(50);
        options.setStartAtSequence(this._lastProcessedSeq + 1);

        this._subscription = this._nats.subscribe('Genesis', options);
        this._subscription.on('message', this._onMessage);
        this._subscription.on('error', this._onNatsError);
    }

    _stopSubscription() {
        try {
            this._closeSubscription();
            this._isPaused = true;
            Logger.info('Genesis subscription is paused');
        } catch (err) {
            Logger.warn('Subscription closing failed:', err);
        }
    }

    _startSubscription() {
        this._isPaused = false;
        this._subscribe();

        Logger.info('Genesis subscription is resumed');
    }

    _onMessage(msg) {
        this._intervalMessagesReceived++;
        const seq = msg.getSequence();
        const fullData = JSON.parse(msg.getData());
        const { name: type, data } = fullData;

        if (!this._isSeqLogged) {
            this._isSeqLogged = true;
            Logger.log(`Genesis event has came, seq: ${seq}`);
        }

        if (this._lastProcessedSeq + 1 !== seq) {
            this._queue.set(seq, {
                type,
                data,
                seq,
            });
            return;
        }

        if (this._lastProcessedSeq && seq !== this._lastProcessedSeq + 1) {
            Logger.warn(`Not sequential events, current: ${seq}, last: ${this._lastProcessedSeq}`);
        }

        this._lastProcessedSeq = seq;

        this._sequentialHandleData(type, data, seq);

        this._checkHandleQueue();
    }

    _checkHandleQueue() {
        while (true) {
            const possibleQueuedSeq = this._lastProcessedSeq + 1;

            if (!this._queue.has(possibleQueuedSeq)) {
                break;
            }

            const { type, data, seq } = this._queue.get(possibleQueuedSeq);
            this._queue.delete(possibleQueuedSeq);
            this._lastProcessedSeq = possibleQueuedSeq;

            this._sequentialHandleData(type, data, seq);
        }
    }

    async _handleData(type, data, seq) {
        metrics.inc('genesis_entity_received', { type });
        metrics.inc(`genesis_entity_received_type_${type.replace(/[^\w]+/, '_')}`);

        if (this._isDataEndReceived) {
            throw new Error('Data received after "dataend" event');
        }

        if (!this._isDataStartReceived) {
            if (type !== 'datastart') {
                throw new Error(`Data received before "datastart" event, seq: ${seq}`);
            }

            this._isDataStartReceived = true;
            this._startCheckNatsInterval();
            return;
        }

        if (this._previousReceivedType && this._previousReceivedType !== type) {
            await this._onTypeEnd(this._previousReceivedType);

            if (type !== 'dataend') {
                Logger.log(`Start processing genesis type (${type}).`);
            }
        }

        if (type === 'dataend') {
            this._isDataEndReceived = true;
            clearInterval(this._checkNatsInterval);
            await this._onDataEnd();
            return;
        }

        await this._handleEvent(type, data);
    }

    async _handleEvent(type, data) {
        if (env.GLS_SAVE_GENESIS_EXAMPLES && this._previousReceivedType !== type) {
            fs.writeFile(
                `genesis_data_example_${type}.json`,
                JSON.stringify(data, null, 2),
                () => {}
            );
        }

        const isProcessed = await this._genesisController.handle(type, data);

        if (!isProcessed && this._previousReceivedType !== type) {
            Logger.warn(`Genesis event (${type}) not processed (skipped).`);
        }

        this._previousReceivedType = type;
    }

    _startCheckNatsInterval() {
        this._checkNatsInterval = setInterval(() => {
            if (this._intervalMessagesReceived === 0) {
                if (this._isPaused || !this._isConnected) {
                    return;
                }

                Logger.info('Timeout reacted, reconnecting');
                this._onNatsError(new Error('No entities timeout'));
                return;
            }

            this._intervalMessagesReceived = 0;
        }, 30000);
    }

    async _onTypeEnd(type) {
        Logger.log(`Genesis type (${type}) is end, start final type sync.`);

        await this._genesisController.typeEnd(type);
    }

    async _onDataEnd() {
        if (this._queue.size) {
            throw new Error('Not empty genesis queue');
        }

        await this._genesisController.finish();

        this._processPromise.resolve();
    }
}

module.exports = GenesisProcessor;
