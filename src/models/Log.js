const MongoDB = require('../services/MongoDB');

module.exports = MongoDB.makeModel(
    'Log',
    {
        entry: {
            type: String,
            required: true,
        },
        type: {
            type: String,
            default: 'log',
            enum: ['log', 'info', 'warn', 'error'],
        },
    },
    {
        index: [
            {
                fields: {
                    type: 1,
                },
            },
        ],
    }
);
