/**
 * Данный код позволяет сохранять тип BigNum в MongoDB через схемы.
 * Для указания типа схемы достаточно указать тип MongoDB.types.BigNumber.
 */

const mongoose = require('mongoose');
const BigNum = require('./BigNum');

// Этот вызов автоматически подключает оригинальный тип.
const BigNumberSchema = require('mongoose-bignumber');

/**
 * Переопределяем конструктор типа mongoose-bignumber
 * для того чтобы получить возможность работать с нашим
 * собственным типом-оберткой.
 */
mongoose.Types.BigNumber.constructor = function(...args) {
    const original = mongoose.Types.BigNumber.constructor.apply(this, args);

    return new BigNum(original);
};
