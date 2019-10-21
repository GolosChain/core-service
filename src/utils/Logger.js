require('colors');
const moment = require('moment');
const metrics = require('./metrics');

/**
 * Логгер действий.
 * Выводит дату с секундами, PID процесса и маркер вида лога в цвете.
 */
class Logger {
    /**
     * Залогировать обычное действие.
     */
    static log(...args) {
        this._log('[log]', args, 'grey');
    }

    /**
     * Залогировать важное действие.
     */
    static info(...args) {
        this._log('[info]', args, 'blue');
    }

    /**
     * Залогировать некритичную ошибку-уведомление.
     */
    static warn(...args) {
        this._log('[warn]', args, 'yellow');
        metrics.inc('log_warnings');
    }

    /**
     * Залогировать ошибку.
     */
    static error(...args) {
        this._log('[error]', args, 'red');
        metrics.inc('log_errors');
    }

    static _log(prefix, args, color) {
        const newArgs = args.map(arg => {
            if (!arg) {
                return arg;
            }

            const type = typeof arg;

            if (type !== 'object') {
                return arg;
            }

            if (arg instanceof Error) {
                return arg;
            }

            return JSON.stringify(arg, null, 2);
        });

        console.log(...[this._now(), `<${process.pid}>`, prefix[color], ...newArgs]);
    }

    static _now() {
        return moment().format('YYYY-MM-DD HH:mm:ss');
    }
}

module.exports = Logger;
