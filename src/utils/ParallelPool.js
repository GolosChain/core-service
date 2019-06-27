/**
 * Помощник для ассинхронных вызовов с ограниченим одновременных вызовов.
 */
class ParallelPool {
    /**
     * Создает очередь паралельных вызовов с ограничением количества одновременных обработок.
     * @param {function} handler - обработчик очереди
     * @param {number} parallelCount - число паралельных обработчиков
     */
    constructor({ handler, parallelCount = 10 } = {}) {
        if (!handler) {
            throw new Error('Need pass handler');
        }

        this._handler = handler;
        this._parallelCount = parallelCount;

        this._isChechking = false;
        this._queue = [];
        this._currentPromises = new Set();
    }

    /**
     * Добавить вызов в очередь выполнения,
     * возвращает результирующие значение из обоботчика обернутое в Promise
     * @param args
     * @returns {Promise<*>}
     */
    queue(...args) {
        const itemInfo = {
            args,
            promise: null,
            resolve: null,
            reject: null,
        };

        itemInfo.promise = new Promise((resolve, reject) => {
            itemInfo.resolve = resolve;
            itemInfo.reject = reject;
        });

        this._queue.push(itemInfo);
        this._checkQueue();

        return itemInfo.promise;
    }

    /**
     * Добавить в очередь выполнения вызовы для обработчика,
     * возвращает массив результирующих значений обернутые в Promise.
     * @param {Array} list
     * @returns {Promise<[]>}
     */
    queueList(list) {
        return Promise.all(list.map(arg => this.queue(arg)));
    }

    /**
     * Получить длину очереди исполнения, включая
     * те функции что уже запущены, но ещё не завершились
     * @return {number} Число функций.
     */
    getQueueLength() {
        return this._currentPromises.size + this._queue.length;
    }

    /**
     * Дождаться завершения всех вызовов (текущих и в очереди)
     */
    async flush() {
        await Promise.all(
            [...this._currentPromises, ...this._queue.map(info => info.promise)].map(
                promise => promise.catch(noop) // flush игнорирует ошибки
            )
        );
    }

    _checkQueue() {
        if (this._queue.length === 0 || this._isChechking) {
            return;
        }

        this._isChechking = true;

        while (this._queue.length && this._currentPromises.size < this._parallelCount) {
            // this._runNext must calling without await
            this._runNext();
        }

        this._isChechking = false;
    }

    async _runNext() {
        const { args, promise, resolve, reject } = this._queue.shift();

        this._currentPromises.add(promise);

        try {
            resolve(await this._handler(...args));
        } catch (err) {
            reject(err);
        }

        this._currentPromises.delete(promise);

        this._checkQueue();
    }
}

function noop() {}

module.exports = ParallelPool;
