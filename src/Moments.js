const moment = require('moment');
const env = require('./Env');

/**
 * Утилита для типичных временных сущностей.
 */
class Moments {
    /**
     * Время начала текущего дня.
     * Учитывает сдвиг из конфигурации DAY_START, смотри Readme.
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
     * Учитывает сдвиг из конфигурации DAY_START, смотри Readme.
     * @returns {moment.Moment} Время как объект moment.js.
     */
    static get lastDayStart() {
        return this.currentDayStart.subtract(1, 'day');
    }

    /**
     * Время в миллисекундах, которое осталось до начала следующего дня.
     * Учитывает сдвиг из конфигурации DAY_START, смотри Readme.
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
     * Один день в виде объекта Duration.
     * @returns {moment.Duration} Время как объект интервала moment.js.
     */
    static get oneDay() {
        return moment.duration(1, 'day');
    }

    static get _dayStart() {
        return env.DAY_START;
    }
}

module.exports = Moments;
