const BN = require('bignumber.js');

/**
 * Обертка над библиотекой bignumber.js.
 * В отличии от оригинала использует более гибкий
 * конструктор, который позволяет передать аргументом
 * сущность в виде значение и постфиксом размерности,
 * например '1000 GBG' будет адекватно конвертированно
 * в 1000, обернутое в объект bignumber.js.
 *
 * Также оборачивает арифметические методы и методы сравнения
 * для инстанса bignumber.js, создавая возможность использовать
 * значения с постфиксами в качестве аргументов.
 */
class BigNum {
    /**
     * Возвращает класс оригинальной библиотеки bignumber.js.
     * @return {{BigNumber}} Класс.
     */
    static OriginalBigNumber() {
        return BN;
    }

    constructor(value) {
        this._value = this._convertValue(value);

        return new Proxy(this._value, {
            get: (target, property) => {
                switch (property) {
                    case 'comparedTo':
                    case 'dividedBy':
                    case 'div':
                    case 'dividedToIntegerBy':
                    case 'idiv':
                    case 'exponentiatedBy':
                    case 'pow':
                    case 'isEqualTo':
                    case 'eq':
                    case 'isGreaterThan':
                    case 'gt':
                    case 'isGreaterThanOrEqualTo':
                    case 'gte':
                    case 'isLessThan':
                    case 'lt':
                    case 'isLessThanOrEqualTo':
                    case 'lte':
                    case 'minus':
                    case 'modulo':
                    case 'mod':
                    case 'multipliedBy':
                    case 'times':
                    case 'plus':
                    case 'squareRoot':
                    case 'sqrt':
                        return this._makeCallWrapper(target, property);
                    default:
                        return target[property];
                }
            },
        });
    }

    /**
     * @return {BN} Оригинальный инстанс bignumber.js.
     */
    rawValue() {
        return this._value;
    }

    _convertValue(value) {
        if (value instanceof BN) {
            return value;
        }

        if (typeof value === 'number') {
            return new BN(value);
        }

        if (typeof value === 'string') {
            const assetNum = value.split(' ')[0];

            if (isNaN(+assetNum)) {
                return new BN(value);
            } else {
                return new BN(assetNum);
            }
        }

        return new BN(value);
    }

    _makeCallWrapper(target, property) {
        return (...rawArgs) => {
            const convertedArgs = [];

            for (let raw of rawArgs) {
                convertedArgs.push(this._convertValue(raw));
            }

            return target[property].apply(this._value, convertedArgs);
        };
    }
}

module.exports = BigNum;
