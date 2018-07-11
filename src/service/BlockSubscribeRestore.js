const golos = require('golos-js');
const stats = require('../Stats').client;
const logger = require('../Logger');
const BasicService = require('./Basic');

class BlockSubscribeRestore extends BasicService {
    constructor(model, blockHandler, blockErrorHandler) {
        super();

        this._model = model;
        this._blockHandler = blockHandler;
        this._blockErrorHandler = blockErrorHandler;
        this._syncedBlockNum = 0;
        this._syncStack = [];
    }

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

    trySync(data, blockNum) {
        const previousBlockNum = blockNum - 1;

        this._currentBlockNum = blockNum;

        if (!this._syncedBlockNum) {
            logger.log(
                'Empty Post collection,',
                `then start sync from block ${previousBlockNum}`
            );
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

        golos.api
            .getBlockAsync(blockNum)
            .then(data => {
                stats.timing('block_restore', new Date() - timer);
                setImmediate(this._sync.bind(this));
                this._blockHandler(data);
            })
            .catch(this._blockErrorHandler);
    }
}

module.exports = BlockSubscribeRestore;
