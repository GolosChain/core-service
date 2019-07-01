const fs = require('fs');
const env = require('../data/env');

class LocalMetrics {
    constructor({ type = 'log', interval = null } = {}) {
        this._values = new Map();
        this._previous = {};

        if (type === 'log') {
            this._interval = interval || 30000;

            setInterval(() => {
                this._print();
            }, this._interval).unref();
        } else if (type === 'file') {
            if (env.GLS_PRESERVE_LOCAL_METRICS) {
                fs.rename('stats.txt', `stats-${Date.now()}.txt`, () => {});
            } else {
                fs.unlink('stats.txt', () => {});
            }

            this._interval = interval || 2000;
            setInterval(() => {
                this._write();
            }, this._interval).unref();
        } else {
            throw new Error('Stats type must be log or file');
        }
    }

    /**
     * Увеличить счетчик.
     * @param {string} metricName
     * @param {number} [count=1]
     */
    inc(metricName, count = 1) {
        let increment;

        if (typeof count === 'number') {
            increment = count;
        } else {
            increment = 1;
        }

        const value = this._values.get(metricName) || 0;
        this._values.set(metricName, value + increment);
    }

    /**
     * Установить значение метрики.
     * (в графиках будет отображено всегда последнее выставленное значение без агрегации)
     * @param {string} metricName
     * @param {number} value
     */
    set(metricName, value) {
        this._values.set(metricName, value);
    }

    /**
     * Записать время.
     * @param {string} metricName
     * @param {number} time
     */
    recordTime(metricName, time) {
        // Время запросов нужно обрабатывать с помощью персентилей и агригационной функции,
        // для локальной разработки это не нужно
    }

    /**
     * Начать замер времени, возвращает функцию которую надо вызвать в конце замера.
     * @param {string} metricName
     * @returns {Function}
     */
    startTimer(metricName) {
        // По аналогии с recordTime
        return () => {};
    }

    _prepare(type) {
        const keys = [...this._values.keys()].sort();
        const current = new Map();

        const lines = keys.map(key => this._formatLine(type, current, key));

        this._previous[type] = current;

        return lines;
    }

    _formatLine(type, current, key) {
        const value = this._values.get(key);
        let prev = null;
        let diff = '';

        current.set(key, value);

        if (this._previous[type]) {
            prev = this._previous[type].get(key);
        }

        if (prev !== undefined && value !== prev) {
            if (typeof value === 'number' && typeof prev === 'number') {
                diff = value - (prev || 0);
            } else {
                diff = prev;
            }

            diff = ` (${diff > 0 ? '+' : ''}${diff})`;
        }

        return `${key}: ${value}${diff}`;
    }

    _print() {
        const lines = this._prepare();

        if (!lines.length) {
            return;
        }

        // Импортируем в момент использования, чтобы избежать циклической зависимости
        const Logger = require('./Logger');

        Logger.info(`== Stats, diff by ${this._interval}ms ==`);

        for (const line of lines) {
            Logger.info(line);
        }
    }

    _write() {
        const lines = this._prepare();

        if (!lines.length) {
            return;
        }

        fs.writeFile(
            'stats.txt',
            `Stats by ${new Date().toJSON()}, diff by ${this._interval}ms\n\n${lines.join('\n')}\n`,
            err => {
                if (err) {
                    // Импортируем в момент использования, чтобы избежать циклической зависимости
                    const Logger = require('./Logger');
                    Logger.error(err);
                }
            }
        );
    }
}

module.exports = LocalMetrics;
