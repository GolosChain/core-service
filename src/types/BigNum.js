const BigNumber = require('bignumber.js');

/**
 * Обертка над библиотекой bignumber.js, доступные
 * методы необходимо смотреть в соответствующей документации.
 * Переопределены только необходимые для переопределения методы.
 *
 * В отличии от оригинала использует более гибкий
 * конструктор и вызовы арифметических методов,
 * позволяя передавать не поддерживаемые в оригинале
 * числоподобные значения, например содержащие постфикс
 * вида '1000 coin'. Использование parseFloat искажает
 * оригинальное значение для очень больних чисел,
 * но эта обертка позволяет работать с ними без потерь.
 */
class BigNum extends BigNumber {
    /**
     * @deprecated
     * Возвращает класс оригинальной библиотеки bignumber.js.
     * @returns {{BigNumber}} Класс.
     */
    static OriginalBigNumber() {
        return BigNumber;
    }

    static clone(config) {
        const original = BigNum;
        const result = class BigNum extends original {};

        if (config) {
            result.config(config);
        }

        return result;
    }

    static maximum(...args) {
        return new BigNum(super.maximum(...args));
    }

    static max(...args) {
        return new BigNum(super.max(...args));
    }

    static minimum(...args) {
        return new BigNum(super.minimum(...args));
    }

    static min(...args) {
        return new BigNum(super.min(...args));
    }

    static random(...args) {
        return new BigNum(super.random(...args));
    }

    /**
     * Конструктор, возвращающий прокси над bignumber.js.
     * @param {number|string|BigInt|BigNumber} value Любое числоподобное
     * значение, включая значения с префиксами и постфиксами.
     * @param {number} [base] Система счисления (от 2 до 36).
     */
    constructor(value, base) {
        super(); // create context only
        super.constructor(this._convertValue(value), base);
    }

    absoluteValue() {
        return new BigNum(super.absoluteValue());
    }

    abs() {
        return new BigNum(super.abs());
    }

    decimalPlaces(...args) {
        const result = super.decimalPlaces(...args);

        if (typeof result === 'number') {
            return result;
        } else {
            return new BigNum(result);
        }
    }

    dp(...args) {
        const result = super.dp(...args);

        if (typeof result === 'number') {
            return result;
        } else {
            return new BigNum(result);
        }
    }

    dividedBy(...args) {
        return new BigNum(super.dividedBy(...args));
    }

    div(...args) {
        return new BigNum(super.div(...args));
    }

    dividedToIntegerBy(...args) {
        return new BigNum(super.dividedToIntegerBy(...args));
    }

    idiv(...args) {
        return new BigNum(super.idiv(...args));
    }

    exponentiatedBy(...args) {
        return new BigNum(super.exponentiatedBy(...args));
    }

    pow(...args) {
        return new BigNum(super.pow(...args));
    }

    integerValue(...args) {
        return new BigNum(super.integerValue(...args));
    }

    minus(...args) {
        return new BigNum(super.minus(...args));
    }

    modulo(...args) {
        return new BigNum(super.modulo(...args));
    }

    mod(...args) {
        return new BigNum(super.mod(...args));
    }

    multipliedBy(...args) {
        return new BigNum(super.multipliedBy(...args));
    }

    times(...args) {
        return new BigNum(super.times(...args));
    }

    negated() {
        return new BigNum(super.negated());
    }

    plus(...args) {
        return new BigNum(super.plus(...args));
    }

    precision(...args) {
        return new BigNum(super.precision(...args));
    }

    sd(...args) {
        return new BigNum(super.sd(...args));
    }

    shiftedBy(...args) {
        return new BigNum(super.shiftedBy(...args));
    }

    squareRoot() {
        return new BigNum(super.squareRoot());
    }

    sqrt() {
        return new BigNum(super.sqrt());
    }

    /**
     * @deprecated
     * @returns {BigNumber} Оригинальный инстанс bignumber.js.
     */
    rawValue() {
        return this;
    }

    /**
     * @returns {string} Значение, пригодное для BSON.
     */
    toBSON() {
        return this.toString();
    }

    _convertValue(value) {
        if (value instanceof BigNumber) {
            return value;
        }

        if (typeof value === 'number') {
            return new BigNumber(value);
        }

        if (typeof value === 'string') {
            value = value.trim();

            const original = new BigNumber(value);

            if (!original.isNaN()) {
                return original;
            }

            const hex = '0x\\d+|-0x\\d+';
            const octal = '0o\\d+|-0o\\d+';
            const binary = '0b\\d+|-0b\\d+';
            const decimal = '\\.\\d*|-\\.\\d*|\\d+\\.\\d*|-\\d+\\.\\d*|\\d+|-\\d+';
            const check = [hex, octal, binary, decimal].join('|');
            const matched = value.match(new RegExp(check));

            if (matched) {
                return new BigNumber(matched[0]);
            } else {
                return original;
            }
        }

        return new BigNumber(value);
    }
}

module.exports = BigNum;
