class Parallel {
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
                Logger.error('Consequentially queue failed:', error);
                process.exit(1);
            }
        }
    }
}

module.exports = Parallel;
