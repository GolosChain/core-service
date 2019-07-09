const Logger = require('./Logger');
const Parallel = require('./Parallel');
const metrics = require('./metrics');

const BULK_SIZE = 200;
const DELAY = 1000;

class BulkSaver {
    constructor(Model, type) {
        this._parallelUtils = new Parallel();

        this._Model = Model;
        this._type = type;
        this._queue = [];
        this._timeout = null;
        this._addedCount = 0;
        this._savedCount = 0;

        this._saveProtected = this._parallelUtils.consequentially(this._save.bind(this));
    }

    addEntry(obj) {
        this._addedCount++;
        this._queue.push(obj);

        metrics.inc(`genesis_type_${this._type}_queued`);
        this._logQueueLength();

        clearTimeout(this._timeout);

        if (this._queue.length === BULK_SIZE) {
            this.save();
            return;
        }

        this._timeout = setTimeout(() => {
            this.save();
        }, DELAY);
    }

    _logQueueLength() {
        metrics.set(`genesis_type_${this._type}_queue_length`, this.getQueueLength());
    }

    async save() {
        return new Promise(resolve => {
            clearTimeout(this._timeout);

            if (this._queue.length === 0) {
                resolve();
                return;
            }

            const queue = this._queue;
            this._queue = [];

            this._saveProtected(queue, resolve);
        });
    }

    async _save(queue, resolve) {
        if (!queue) {
            return;
        }

        try {
            const start = Date.now();
            const result = await this._Model.insertMany(queue, { ordered: true });
            metrics.set(`genesis_type_${this._type}_last_saving_time`, Date.now() - start);

            this._savedCount += queue.length;
            metrics.inc(`genesis_type_${this._type}_saved`, queue.length);
            this._logQueueLength();
            resolve(result);
        } catch (err) {
            Logger.error('BulkSaver failed:', err);
            process.exit(1);
        }
    }

    getSavedCount() {
        return this._savedCount;
    }

    getQueueLength() {
        return this._addedCount - this._savedCount;
    }

    async finish() {
        await this.save();
        // Вызываем без аргументов чтобы дождаться завершения всех действий в очереди
        await this._saveProtected();
        this._logQueueLength();
    }
}

module.exports = BulkSaver;
