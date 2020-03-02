const MongoDB = require('../services/MongoDB');

module.exports = MongoDB.makeModel('BlockSubscribe', {
    nodeId: {
        type: String,
        default: null,
    },
    lastBlockNum: {
        type: Number,
        default: 0,
    },
    lastBlockSequence: {
        type: Number,
        default: 0,
    },
    lastIrrBlockId: {
        type: String,
        default: null,
    },
    lastIrrBlockNum: {
        type: Number,
        default: 0,
    },
});
