const BN = require('bignumber.js');

/**
 * Обертка над библиотекой bignumber.js.
 * В отличии от оригинала использует более гибкий
 * конструктор и вызовы арифметических методов,
 * позволяя передавать не поддерживаемые в оригинале
 * числоподобные значения, например содержащие постфикс
 * вида '1000 gbg'. Использование parseFloat искажает
 * оригинальное значение для очень больних чисел,
 * но эта обертка позволяет работать с ними без потерь.
 */
class BigNum {
    /**
     * Возвращает класс оригинальной библиотеки bignumber.js.
     * @return {{BigNumber}} Класс.
     */
    static OriginalBigNumber() {
        return BN;
    }

    /**
     * Конструктор, возвращающий прокси над bignumber.js.
     * @param {number|string|BigInt|BN} value Любое числоподобное
     * значение, включая значения с префиксами и постфиксами.
     * @return {Proxy} Прокси.
     */
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
                    case 'rawValue':
                        return this.rawValue.bind(this);
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
            value = value.trim();

            const original = new BN(value);

            if (!original.isNaN()) {
                return original;
            }

            const hex = '0x\\d+|-0x\\d+';
            const octal = '0o\\d+|-0o\\d+';
            const binary = '0b\\d+|-0b\\d+';
            const decimal = '\\d+|-\\d+';
            const check = [hex, octal, binary, decimal].join('|');
            const matched = value.match(new RegExp(check));

            if (matched) {
                return new BN(matched[0]);
            } else {
                return original;
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

            const result = target[property].apply(this._value, convertedArgs);

            if (result instanceof BN) {
                return new BigNum(BN);
            }

            return result;
        };
    }
}

module.exports = BigNum;
