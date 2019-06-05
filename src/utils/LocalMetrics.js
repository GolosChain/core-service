const fs = require('fs');
const Logger = require('./Logger');

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
            // Remove old stats.txt
            fs.unlink('stats.txt', () => {});
            this._interval = interval || 2000;
            setInterval(() => {
                this._write();
            }, this._interval).unref();
        } else {
            throw new Error('Stats type must be log or file');
        }
    }

    inc(name) {
        const value = this._values.get(name) || 0;
        this._values.set(name, value + 1);
    }

    set(name, value) {
        this._values(name, value);
    }

    recordTime() {
        // Добавить в будущем
    }

    startTimer() {
        // Добавить в будущем
    }

    _prepare(type) {
        const keys = [...this._values.keys()].sort();
        const current = new Map();

        const lines = keys.map(key => {
            const value = this._values.get(key);
            let prev = null;
            let diff = '';

            current.set(key, value);

            if (this._previous[type]) {
                prev = this._previous[type].get(key);
            }

            if (value !== prev) {
                if (typeof value === 'number' && typeof prev === 'number') {
                    diff = value - (prev || 0);
                } else {
                    diff = prev;
                }

                diff = ` (${diff > 0 ? '+' : ''}${diff})`;
            }

            return `${key}: ${value}${diff}`;
        });

        this._previous[type] = current;

        return lines;
    }

    _print() {
        const lines = this._prepare();

        if (!lines.length) {
            return;
        }

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
            '.stats.txt',
            `Stats by ${new Date().toJSON()}, diff by ${this._interval}ms\n\n${lines.join('\n')}\n`,
            err => {
                if (err) {
                    Logger.error('Stats logging failed:', err);
                    return;
                }

                fs.rename('.stats.txt', 'stats.txt', () => {});
            }
        );
    }
}

module.exports = LocalMetrics;
