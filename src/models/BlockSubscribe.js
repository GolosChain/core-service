const MongoDB = require('../services/MongoDB');

module.exports = MongoDB.makeModel('BlockSubscribe', {
    lastBlockNum: {
        type: Number,
        default: 0,
    },
    lastBlockTime: {
        type: Date,
        default: null,
    },
    lastBlockSequence: {
        type: Number,
        default: 0,
    },
});
