require('colors');
const moment = require('moment');
const metrics = require('./metrics');
const env = require('../data/env');
const LogsModel = require('./LogsModel');

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
        this._writeLogsToDB(args, 'log').catch(error => {
            console.error('Cannot write logs entry: ', error);
        });
    }

    /**
     * Залогировать важное действие.
     */
    static info(...args) {
        this._log('[info]', args, 'blue');
        this._writeLogsToDB(args, 'info').catch(error => {
            console.error('Cannot write logs entry: ', error);
        });
    }

    /**
     * Залогировать некритичную ошибку-уведомление.
     */
    static warn(...args) {
        this._log('[warn]', args, 'yellow');
        this._writeLogsToDB(args, 'warn').catch(error => {
            console.error('Cannot write logs entry: ', error);
        });
        metrics.inc('log_warnings');
    }

    /**
     * Залогировать ошибку.
     */
    static error(...args) {
        this._log('[error]', args, 'red');
        this._writeLogsToDB(args, 'erroe').catch(error => {
            console.error('Cannot write logs entry: ', error);
        });
        metrics.inc('log_errors');
    }

    static _log(prefix, data, color) {
        console.log(...[this._now(), `<${process.pid}>`, prefix[color], ...data]);
    }

    static _now() {
        return moment().format('YYYY-MM-DD HH:mm:ss');
    }

    static async _writeLogsToDB(args, type) {
        if (!env.GLS_DB_LOGS_ENABLED) {
            return;
        }
        const entryStrings = [];
        for (const originalEntry in args) {
            if (['string', 'number', 'boolean'].includes(typeof originalEntry)) {
                entryStrings.push(String(originalEntry));
            } else {
                entryStrings.push(JSON.stringify(originalEntry));
            }
        }
        return await LogsModel.create({ entry: entryStrings.concat(' '), type });
    }
}

module.exports = Logger;
