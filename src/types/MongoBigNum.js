const mongoose = require('mongoose');
const BigNum = require('./BigNum');

/**
 * Добавляет возможность использовать BigNum для хранения данных в MongoDB.
 * Подключение типа происходит автоматически при подключении этого файла.
 */
class MongoBigNum extends mongoose.SchemaType {
    cast(value) {
        return new BigNum(value);
    }
}

mongoose.Schema.Types.MongoBigNum = MongoBigNum;

module.exports = mongoose.Schema.Types.MongoBigNum;
