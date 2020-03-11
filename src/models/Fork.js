const MongoDB = require('../services/MongoDB');

module.exports = MongoDB.makeModel(
    'Fork',
    {
        blockNum: {
            type: Number,
            required: true,
        },
        blockTime: {
            type: Date,
            required: true,
        },
        blockSequence: {
            type: Number,
            required: true,
        },
        finalized: {
            type: Boolean,
            required: true,
        },
        stack: {
            type: [
                {
                    type: {
                        type: String,
                        required: true,
                    },
                    modelName: {
                        type: String,
                    },
                    // TODO: className for backward compatibility, remove later.
                    className: {
                        type: String,
                    },
                    documentId: {
                        type: MongoDB.mongoTypes.ObjectId,
                    },
                    data: {
                        type: Object,
                    },
                    meta: {
                        type: Object,
                    },
                },
            ],
        },
    },
    {
        index: [
            {
                fields: {
                    blockNum: -1,
                },
                options: {
                    unique: true,
                },
            },
        ],
    }
);
