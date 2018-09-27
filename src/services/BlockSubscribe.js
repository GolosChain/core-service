const BasicService = require('./Basic');
const golos = require('golos-js');
const BlockUtils = require('../utils/Block');
const Logger = require('../utils/Logger');
const stats = require('../utils/statsClient');

/**
 * Сервис подписки получения новых блоков.
 * Подписывается на рассылку блоков от golos-ноды.
 * Каждый полученный блок сериализует и передает в эвенте
 * 'block', а в случае форка вызывается эвент 'fork'.
 * Альтернативно для получения данных блока можно
 * использовать callback-функцию.
 */
class BlockSubscribe extends BasicService {
    constructor(lastBlockNum, resendOnFork) {
        super();

        this._lastBlockNum = lastBlockNum;
        this._resendOnFork = resendOnFork;

        this._callback = null;
        this._blockQueue = [];
        this._firstBlockNum = null;
        this._notifierPaused = false;
    }

    /**
     * Вызывается в случае получения нового блока из блокчейна.
     * @event block
     * @property {Object} block Блок данных.
     * @property {number} blockNum Номер блока.
     * @property {boolean} forkRewrite Флаг факта повторной отправки блока в связи с форком.
     */

    /**
     * Вызывается в случае обнаружения форка, оповещает о номере блока,
     * с которого начинаются расхождения.
     * @event fork
     * @property {number} blockNum Номер блока.
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

        this._runSubscribe();

        this.on('readyToNotify', () => {
            this._runNotifier().catch(error => {
                throw error;
            });
        });

        this.on('firstBlockGet', blockNum => {
            this._runBootRestore(blockNum).catch(error => {
                Logger.error(`Cant handle first block - ${error}`);
                process.exit(1);
            });
            this._runForkRestore();
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

            this._blockQueue.push({ block, blockNum });

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

        Logger.info('BlockSubscribe - restore blocks...');

        if (blockNum === this._lastBlockNum) {
            this._blockQueue.shift();
            this.emit('readyToNotify');
            return;
        }

        let currentBlock = blockNum;

        while (--currentBlock > this._lastBlockNum) {
            const block = await this._getBlock(currentBlock);

            Logger.info(`BlockSubscribe - restore block ${currentBlock}`);

            this._blockQueue.unshift({ block, blockNum: currentBlock });
        }

        Logger.info('BlockSubscribe - restore blocks done!');

        this.emit('readyToNotify');
    }

    async _getBlock(blockNum) {
        return await golos.api.getBlockAsync(blockNum);
    }

    _runForkRestore() {
        // TODO -
    }

    async _runNotifier() {
        while (true) {
            if (!this._notifierPaused) {
                this._notify();
            }
            await new Promise(resolve => {
                setImmediate(resolve);
            });
        }
    }

    _notify() {
        let blockData;

        while ((blockData = this._blockQueue.shift())) {
            const { block, blockNum, forkRewrite } = blockData;

            this.emit('block', block, blockNum, forkRewrite);

            if (this._callback) {
                this._callback(block, blockNum, forkRewrite);
            }
        }
    }
}

module.exports = BlockSubscribe;
