const sleep = require('then-sleep');

/**
 * Ожидает обработки транзакции призмой
 * По истечении максимального времени ожидания вернет пустой промис
 * @param {string} transactionId id транзакции в БЧ
 * @param {Connector} connector объект коннекотра, который будет отсылать запрос
 * @param {string} prismServiceName название призмы в коннекторе; default='prism'
 * @param {number} maxWait максимальное время ожидания; default=10000
 * @returns {Promise<any | void>}
 */
async function waitForTransaction(
    transactionId,
    connector,
    { prismServiceName = 'prism', maxWait = 10000 }
) {
    if (!connector) {
        throw new Error('"connector" parameter is required');
    }
    return await Promise.race([
        sleep(maxWait),
        _callPrismWaitForTransaction(transactionId, connector, { prismServiceName }),
    ]);
}

/**
 * Вызывает метод waitForTransaction призмы
 * @param {string} transactionId id транзакции в БЧ
 * @param {Connector} connector объект коннекотра, который будет отсылать запрос
 * @param {string} prismServiceName название призмы в коннекторе; default='prism'
 * @returns {Promise<void>}
 * @private
 */
async function _callPrismWaitForTransaction(transactionId, connector, { prismServiceName }) {
    try {
        await connector.callService(prismServiceName, 'waitForTransaction', {
            transactionId,
        });
    } catch (error) {
        if (error.code !== 408 && error.code !== 'ECONNRESET' && error.code !== 'ETIMEDOUT') {
            Logger.error(`Error calling ${prismServiceName}.waitForTransaction`, error);

            throw error;
        }
    }
}

module.exports = waitForTransaction;
