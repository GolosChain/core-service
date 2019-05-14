class Parallel {
    parallelProtection(callback) {
        const queue = [];
        let isProcessing = false;

        async function checkQueue() {
            if (queue.length === 0 || isProcessing) {
                return;
            }

            isProcessing = true;

            const args = queue.shift();

            try {
                await callback(...args);
            } catch (err) {
                Logger.error('Processing failed:', err);
                process.exit(1);
            }

            isProcessing = false;

            setImmediate(checkQueue);
        }

        return function(...args) {
            queue.push(args);
            checkQueue();
        };
    }
}

module.exports = new Parallel();
