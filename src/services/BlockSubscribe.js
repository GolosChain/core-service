const sleep = require('then-sleep');
const isEqual = require('lodash.isequal');
const BasicService = require('./Basic');
const golos = require('golos-js');
const BlockUtils = require('../utils/Block');
const BlockChainValues = require('../utils/BlockChainValues');
const Logger = require('../utils/Logger');
const stats = require('../utils/statsClient');
const env = require('../data/env');

/**
 * Сервис подписки получения новых блоков.
 * Подписывается на рассылку блоков от golos-ноды.
 * Каждый полученный блок сериализует и передает в эвенте
 * 'block', а в случае форка вызывается эвент 'fork'.
 * Альтернативно для получения данных блока можно
 * использовать callback-функцию.
 */
class BlockSubscribe extends BasicService {
    constructor(lastBlockNum) {
        super();

        this._lastBlockNum = lastBlockNum;

        this._callback = null;
        this._blockQueue = [];
        this._firstBlockNum = null;

        this._irreversibleBlockNum = null;
        this._previousBlockBody = null;
    }

    /**
     * Вызывается в случае получения нового блока из блокчейна.
     * @event block
     * @property {Object} block Блок данных.
     * @property {number} blockNum Номер блока.
     */

    /**
     * Вызывается в случае обнаружения форка, оповещает о номере блока,
     * с которого начинаются расхождения.
     * После этого эвента подписчик прекращает свою работу.
     * @event fork
     * @property {number} irreversibleBlockNum Номер гарантированного неоткатного блока.
     */

    /**
     * Эвент, вызываемый в начале при получении первого блока из подписки.
     * @event firstBlockGet
     * @property {number} blockNum Номер блока.
     */

    /**
     * Эвент, вызываемый в момент готовности рассылки полученных блоков подписчикам.
     * @event readyToNotify
     * @property {number} blockNum Номер блока.
     */

    /**
     * Запуск.
     * @param {Function} callback Альтернтативный способ получения данных блока,
     * повторяет апи эвента 'block'.
     * @returns {Promise<void>} Промис без экстра данных.
     */
    async start(callback = null) {
        this._callback = callback;

        await this._runIrreversibleUpdateLoop();
        this._runSubscribe();

        this.on('readyToNotify', () => {
            this._runNotifier().catch(error => {
                Logger.error(`BlockSubscribe - notifier error ${error}`);
                process.exit(1);
            });
        });

        this.on('firstBlockGet', blockNum => {
            this._runBootRestore(blockNum).catch(error => {
                Logger.error(`Cant handle first block - ${error}`);
                process.exit(1);
            });
        });
    }

    _runSubscribe() {
        this._callSubscriber((error, block) => {
            const timer = new Date();

            if (error) {
                Logger.error(`Block subscribe error - ${error}`);
                process.exit(1);
            }

            const blockNum = BlockUtils.extractBlockNum(block);

            this._blockQueue.push([block, blockNum]);

            stats.timing('block_subscribe_get_block', new Date() - timer);

            if (!this._firstBlockNum) {
                this._firstBlockNum = blockNum;
                this.emit('firstBlockGet', blockNum);
            }
        });
    }

    _callSubscriber(callback) {
        golos.api.setBlockAppliedCallback('full', callback);
    }

    async _runBootRestore(blockNum) {
        if (typeof this._lastBlockNum !== 'number') {
            Logger.log('BlockSubscribe - last block num not defined, skip boot restore.');
            this.emit('readyToNotify');
            return;
        }

        if (blockNum === this._lastBlockNum) {
            this._blockQueue.shift();
            this.emit('readyToNotify');
            return;
        }

        let currentBlock = blockNum;

        while (--currentBlock > this._lastBlockNum) {
            this._blockQueue.unshift(currentBlock);
        }

        Logger.info('BlockSubscribe - ready to start notify!');
        this.emit('readyToNotify');
    }

    async _getBlock(blockNum) {
        return await BlockUtils.getByNum(blockNum);
    }

    async _runIrreversibleUpdateLoop() {
        try {
            await this._updateIrreversibleBlockNum();
        } catch (error) {
            Logger.error(`Cant load irreversible num, but continue - ${error}`);
            await sleep(1000);
            await this._runIrreversibleUpdateLoop();
            return;
        }

        setInterval(async () => {
            try {
                await this._updateIrreversibleBlockNum();
            } catch (error) {
                Logger.error(`Cant load irreversible num, but skip - ${error}`);
            }
        }, env.GLS_IRREVERSIBLE_BLOCK_UPDATE_INTERVAL);
    }

    async _updateIrreversibleBlockNum() {
        const props = await BlockChainValues.getDynamicGlobalProperties();
        const irreversible = props.last_irreversible_block_num;

        if (irreversible && typeof irreversible === 'number') {
            this._irreversibleBlockNum = irreversible;
        } else {
            throw 'Invalid props format';
        }
    }

    async _runNotifier() {
        while (true) {
            const result = await this._notifyByQueue();

            if (result === false) {
                return;
            }

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
        const [blockBody, blockNum] = await this._extractNotifierBlockData(item);

        if (this._previousBlockBody) {
            const previousBlockBody = await BlockUtils.getByNum(blockNum - 1);

            for (let operation of previousBlockBody._virtual_operations) {
                delete operation.trx_id;
                delete operation.block;
                delete operation.timestamp;
            }

            if (!isEqual(previousBlockBody, this._previousBlockBody)) {
                this.emit('fork', this._irreversibleBlockNum);
                return false;
            }
        }

        this._previousBlockBody = blockBody;

        this.emit('block', blockBody, blockNum);

        if (this._callback) {
            this._callback(blockBody, blockNum);
        }
    }

    async _extractNotifierBlockData(item) {
        if (typeof item === 'number') {
            const block = await this._getBlock(item);
            const blockNum = BlockUtils.extractBlockNum(block);

            Logger.info(`BlockSubscribe - restore block ${item}`);

            return [block, blockNum];
        } else {
            return item;
        }
    }
}

module.exports = BlockSubscribe;
