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
        this._blockQueue = [];
        this._pendingTransactionsBuffer = new Map();
        this._handledTransactionsBuffer = new Map();
        this._handledBlocksBuffer = new Map();
        this._connection = null;
    }

    async start() {
        this._connectToMessageBroker();
        this._makeBlockHandlers();
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

    async _handleTransactionApply(message) {
        try {
            const data = JSON.parse(message.getData());

            for (const action of data.actions) {
                if (action.data !== '') {
                    // TODO Another detect 
                    console.log(action.data);
                    continue;
                }

                // TODO Store in buffer
                console.log(action);
            }
        } catch (error) {
            Logger.error(`Handle transaction error - ${error}`);
            process.exit(1);
        }
    }

    async _handleBlockAccept() {
        try {
            // TODO -
        } catch (error) {
            Logger.error(`Handle block error - ${error}`);
            process.exit(1);
        }
    }

    _makeMessageHandler(type, callback) {
        const delta = env.GLS_BLOCKCHAIN_BROADCASTER_REPLAY_TIME_DELTA;
        const opts = this._connection
            .subscriptionOptions()
            .setStartWithLastReceived()
            .setStartAtTimeDelta(delta);
        const subscription = this._connection.subscribe(type, opts);

        subscription.on('message', callback);
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
        if (block.num >= this._startFromBlock) {
            this.emit('block', block);
        }
    }
}

module.exports = BlockSubscribe;
