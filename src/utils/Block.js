const golos = require('golos-js');

/**
 * Утилита для работы с данными блока блокчейна.
 */
class Block {
    /**
     * Получение блока по указанному номеру.
     * @param {Number} blockNum Номер блока.
     * @return {Object} Блок в сыром виде.
     */
    static async getByNum(blockNum) {
        const block = await golos.api.getBlockAsync(blockNum);

        block._virtual_operations = await golos.api.getOpsInBlockAsync(blockNum, true);

        return block;
    }

    /**
     * Извлекает номер блока из данных блока.
     * @param {Object} block Целевой блок.
     * @return {number} Номер блока.
     */
    static extractBlockNum(block) {
        const previousHash = block.previous;
        const previousBlockNum = parseInt(previousHash.slice(0, 8), 16);

        return previousBlockNum + 1;
    }

    /**
     * Итерируется по транзакциям в блоке.
     * @param {Object} block Блок.
     * @return {IterableIterator<Object>} Итератор.
     */
    static *eachTransaction(block) {
        for (let transaction of block.transactions) {
            yield transaction;
        }
    }

    /**
     * Итерируется по "реальным" операциям внтури блока.
     * В итерацию попадают операции из транзакций в блокчейне.
     * @param {Object} block Блок.
     * @return {IterableIterator<Object>} Итератор.
     */
    static *eachRealOperation(block) {
        for (let transaction of this.eachTransaction(block)) {
            for (let operationPack of transaction.operations) {
                if (Array.isArray(operationPack)) {
                    yield [operationPack[0], operationPack[1]];
                } else {
                    yield [operationPack.operationType, operationPack];
                }
            }
        }
    }

    /**
     * Аналог "eachRealOperation", но возвращает результат в колбек.
     * @param {Object} block Блок.
     * @param {Function} callback Колбек.
     */
    static eachRealOperationCb(block, callback) {
        for (let operation of this.eachRealOperation(block)) {
            callback(operation);
        }
    }

    /**
     * Итерируется по "виртуальным" операциям внутри блока.
     * В итерацию попадают не явные операции, исполняемые на блокчейн-ноде.
     * @param {Object} block Блок.
     * @return {IterableIterator<Object>} Итератор.
     */
    static *eachVirtualOperation(block) {
        if (!block._virtual_operations) {
            return;
        }

        for (let virtual of block._virtual_operations) {
            if (!virtual.op) {
                yield [virtual.operationType, virtual];
                continue;
            }

            const operations = virtual.op;

            for (let i = 1; i < operations.length; i += 2) {
                const type = operations[i - 1];
                const data = operations[i];

                yield [type, data];
            }
        }
    }

    /**
     * Аналог "eachVirtualOperation", но возвращает результат в колбек.
     * @param {Object} block Блок.
     * @param {Function} callback Колбек.
     */
    static eachVirtualOperationCb(block, callback) {
        for (let operation of this.eachVirtualOperation(block)) {
            callback(operation);
        }
    }
}

module.exports = Block;
