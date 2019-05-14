class ParallelUtils {
    protect(callback) {
        const queue = [];
        const check = this._makeQueueChecker(queue, callback);

        return function(...args) {
            queue.push(args);
            check();
        };
    }

    _makeQueueChecker(queue, callback) {
        let isProcessing = false;

        return async function() {
            if (isProcessing) {
                return;
            }

            isProcessing = true;

            let args;

            while ((args = queue.shift())) {
                try {
                    await callback(...args);
                } catch (err) {
                    Logger.error('Processing failed:', err);
                    process.exit(1);
                }
            }

            isProcessing = false;
        };
    }
}

module.exports = ParallelUtils;
