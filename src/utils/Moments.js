const moment = require('moment');
const env = require('../data/env');

/**
 * @deprecated
 * Утилита для типичных временных сущностей.
 */
class Moments {
    /**
     * Время в прошлом относительно текущей даты.
     * @param {Number} milliseconds Количество миллисекунд отступа назад.
     * @returns {moment.Moment} Время в прошлом.
     */
    static ago(milliseconds) {
        return moment().subtract(moment.duration(milliseconds, 'ms'));
    }

    /**
     * Время начала текущего дня.
     * Учитывает сдвиг из конфигурации GLS_DAY_START, смотри Readme.
     * @returns {moment.Moment} Время как объект moment.js.
     */
    static get currentDayStart() {
        return moment()
            .utc()
            .startOf('day')
            .hour(this._dayStart);
    }

    /**
     * Время начала предыдущего дня.
     * Учитывает сдвиг из конфигурации GLS_DAY_START, смотри Readme.
     * @returns {moment.Moment} Время как объект moment.js.
     */
    static get lastDayStart() {
        return this.currentDayStart.subtract(1, 'day');
    }

    /**
     * Время в миллисекундах, которое осталось до начала следующего дня.
     * Учитывает сдвиг из конфигурации GLS_DAY_START, смотри Readme.
     * @returns {number} Число в миллисекундах.
     */
    static get remainedToNextDay() {
        const diff = moment()
            .utc()
            .add(this._dayStart * 2, 'hours');

        return moment()
            .utc()
            .startOf('day')
            .hour(this._dayStart)
            .add(1, 'day')
            .diff(diff);
    }

    /**
     * Одна минута в виде объекта Duration.
     * @returns {moment.Duration} Время как объект moment.js.
     */
    static get oneMinute() {
        return moment.duration(1, 'minute');
    }

    /**
     * Один день в виде объекта Duration.
     * @returns {moment.Duration} Время как объект интервала moment.js.
     */
    static get oneDay() {
        return moment.duration(1, 'day');
    }

    static get _dayStart() {
        return env.GLS_DAY_START;
    }
}

module.exports = Moments;
