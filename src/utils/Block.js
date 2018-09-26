class Block {
    static eachRealOperation(block, fn) {
        for (let operation of this.eachRealOperationGen()) {
            fn(operation);
        }
    }

    static *eachRealOperationGen(block) {
        for (let transaction of block.transactions) {
            for (let operation of transaction.operations) {
                yield operation;
            }
        }
    }

    static eachVirtualOperation(block, fn) {
        for (let operation of this.eachVirtualOperationGen(block)) {
            fn(operation);
        }
    }

    static *eachVirtualOperationGen(block) {
        if (!block._virtual_operations) {
            return;
        }

        for (let virtual of block._virtual_operations) {
            const operations = virtual.op;

            for (let i = 1; i < operations.length; i += 2) {
                const type = operations[i - 1];
                const data = operations[i];

                yield [type, data];
            }
        }
    }
}

module.exports = Block;
