require('colors');
const moment = require('moment');

/**
 * Логгер действий.
 * Выводит дату с секундами, PID процесса и маркер вида лога в цвете.
 */
class Logger {
    /**
     * Залогировать обычное действие.
     */
    static log() {
        this._log('[log]', arguments, 'grey');
    }

    /**
     * Залогировать важное действие.
     */
    static info() {
        this._log('[info]', arguments, 'blue');
    }

    /**
     * Залогировать ошибку.
     */
    static error() {
        this._log('[error]', arguments, 'red');
    }

    static _log(prefix, data, color) {
        console.log.apply(console, [this._now(), `<${process.pid}>`, prefix[color], ...data]);
    }

    static _now() {
        return moment().format('YYYY-MM-DD HH:mm:ss');
    }
}

module.exports = Logger;
