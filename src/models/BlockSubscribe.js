const MongoDB = require('../services/MongoDB');

module.exports = MongoDB.makeModel('BlockSubscribe', {
    lastBlockNum: {
        type: Number,
        default: 0,
    },
    lastBlockSequence: {
        type: Number,
        default: 0,
    },
});
