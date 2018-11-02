const golos = require('golos-js');
const stats = require('../utils/statsClient');
const logger = require('../utils/Logger');
const BasicService = require('./Basic');
const BlockUtils = require('../utils/Block');

/**
 * @deprecated
 * Сервис восстановления пропущенных блоков, необходим в случае
 * простоя микросервиса, за которое блокчейн мог сгенерировать новые блоки,
 * которые также необходимо обработать.
 * Последний обработанный блок находит по принципу поиска максимального
 * номера блока из документов, что предоставляет модель.
 * В случае отсутствия такового считает что микросервис свежезапущенный
 * и восстановление не требуется. В ином случае начинает загрузку пропущенных
 * блоков и на каждый блок запускает колбек, который должен обрабатывать
 * пропущенные блоки.
 *
 * Для запуска процесса непосредственно востановления необходимо вызвать метод
 * trySync, отправив туда текущий блок и номер текущего блока. В случае обнаружения
 * пропуска - система автоматически восстановит все пропущенные блоки.
 * При использовании совместно с BlockSubscribe рекомендуется вызвать этот метод на
 * каждый полученный блок.
 *
 * Идеально подходит для установки в restore виртуального сервиса, работающего
 * с блоками блокчейна реалтайм.
 *
 * Кейс использования - создание экземпляра сервиса в конструкторе целевого сервиса,
 * запуск этого сервиса в методе restore целевого сервиса,
 * подписка на новые блоки через сервис BlockSubscribe,
 * на каждый полученный блок - вызов метода trySync.
 */
class BlockSubscribeRestore extends BasicService {
    /**
     * Конструктор виртуального сервиса
     * @param {Mongoose.Model} model Модель Mongoose, хранящая документы, содержащие поле blockNum.
     * @param {Function} blockHandler Функция обработки блока,
     * будет вызвана на каждый пропущенный блок.
     * @param {Function} blockErrorHandler Функия обработки ошибки при получении блока.
     */
    constructor(model, blockHandler, blockErrorHandler) {
        super();

        this._model = model;
        this._blockHandler = blockHandler;
        this._blockErrorHandler = blockErrorHandler;
        this._syncedBlockNum = 0;
        this._syncStack = [];
    }

    /**
     * Запускает виртуальный сервис, но не запускает сам процесс восстановления, а определяет
     * последний обработанный блок. Для запуска восстановления смотри метод trySync.
     * @returns {Promise<void>} Промис без экстра данных.
     */
    async start() {
        const timer = new Date();
        const atLastBlock = await this._model.findOne(
            {},
            { blockNum: true, _id: false },
            { sort: { blockNum: -1 } }
        );

        if (atLastBlock) {
            this._syncedBlockNum = atLastBlock.blockNum;
        }

        stats.timing('last_block_num_search', new Date() - timer);
    }

    /**
     * Запускает процесс восстановления (синхронизации) в случае обнаружении пропуска.
     * При использовании совместно с BlockSubscribe рекомендуется вызвать этот метод на
     * каждый полученный блок.
     * @param {Object} data Данные блока.
     * @param {number} blockNum Номер блока
     */
    trySync(data, blockNum) {
        const previousBlockNum = blockNum - 1;

        this._currentBlockNum = blockNum;

        if (!this._syncedBlockNum) {
            logger.log('Empty sync collection,', `then start sync from block ${previousBlockNum}`);
            this._syncedBlockNum = previousBlockNum;
        }

        if (previousBlockNum !== this._syncedBlockNum) {
            this._populateSyncQueue();
            this._sync();
        }

        this._syncedBlockNum = this._currentBlockNum;
    }

    _populateSyncQueue() {
        const from = this._syncedBlockNum + 1;
        const to = this._currentBlockNum - 1;

        for (let i = from; i < to; i++) {
            this._syncStack.push(i);
        }
    }

    _sync() {
        if (this._syncStack.length === 0) {
            return;
        }

        // async lightweight step-by-step data sync strategy
        const blockNum = this._syncStack.pop();
        const timer = new Date();

        logger.log(`Restore missed registration for block - ${blockNum}`);

        BlockUtils.getByNum(blockNum)
            .then(data => {
                stats.timing('block_restore', new Date() - timer);
                setImmediate(this._sync.bind(this));
                this._blockHandler(data, blockNum);
            })
            .catch(this._blockErrorHandler);
    }
}

module.exports = BlockSubscribeRestore;
