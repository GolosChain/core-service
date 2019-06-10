const Logger = require('./Logger');

/**
 * Утилита для работы с асинхронными параллельными вычислениями.
 */
class Parallel {
    /**
     * Создаёт буфер вызова на основе переданной функции-колбека.
     * Буфер можно вызывать как функцию сколько угодно раз, на каждый раз
     * будет асинхронно вызвана функция-колбек, но следующий вызов
     * будет дожидаться завершения предыдущих, что гарантирует
     * последовательность исполнения функций друг за другом по факту
     * завершения предыдущей, вне зависимости от времени появления
     * следующего вызова или времени исполнения функции-колбека.
     * Буфер не возвращает результат исполнения функции-колбека,
     * для получения результатов вычислений необходимо обрабатывать
     * их в самой функции-колбеке.
     * @param {Function} callback Функция-колбек.
     * @return {Function} Буфер вызова.
     */
    consequentially(callback) {
        const state = {
            queue: [],
            isCanceled: false,
            callback,
        };

        state.handle = this._makeQueueHandler(state);

        const wrapperCallback = (...args) => {
            if (state.isCanceled) {
                throw new Error('Queue have been canceled');
            }

            state.queue.push(args);
            state.handle();
        };

        wrapperCallback.getQueueLength = () => {
            if (!state.queue) {
                return 0;
            }
            return state.queue.length;
        };

        wrapperCallback.cancel = () => {
            state.isCanceled = true;
            state.queue = null;
        };

        return wrapperCallback;
    }

    _makeQueueHandler(state) {
        let isProcessing = false;

        return async () => {
            if (isProcessing) {
                return;
            }

            isProcessing = true;
            await this._handleQueue(state);
            isProcessing = false;
        };
    }

    async _handleQueue(state) {
        let args;

        while ((args = state.queue.shift())) {
            try {
                await state.callback.apply(null, args);
            } catch (error) {
                Logger.error('Consequentially queue failed:', error);
                process.exit(1);
            }
        }
    }
}

module.exports = Parallel;
