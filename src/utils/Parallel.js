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
        const queue = [];
        const handle = this._makeQueueHandler(queue, callback);

        return (...args) => {
            queue.push(args);
            handle();
        };
    }

    _makeQueueHandler(queue, callback) {
        let isProcessing = false;

        return async () => {
            if (isProcessing) {
                return;
            }

            isProcessing = true;
            await this._handleQueue(queue, callback);
            isProcessing = false;
        };
    }

    async _handleQueue(queue, callback) {
        let args;

        while ((args = queue.shift())) {
            try {
                await callback(...args);
            } catch (error) {
                Logger.error('Consequentially queue failed:', error.stack);
                process.exit(1);
            }
        }
    }
}

module.exports = Parallel;
