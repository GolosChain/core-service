const express = require('express');
const client = require('prom-client');
const env = require('../data/env');

class PrometheusMetrics {
    constructor() {
        if (env.GLS_SYSTEM_METRICS) {
            client.collectDefaultMetrics({ timeout: 5000 });
        }

        this._counters = new Map();
        this._gauges = new Map();
        this._histograms = new Map();

        this._server = express();

        this._server.get('/metrics', (req, res) => {
            res.set('Content-Type', client.register.contentType);
            res.end(client.register.metrics());
        });

        this._server.listen(env.GLS_METRICS_PORT, env.GLS_METRICS_HOST, err => {
            if (err) {
                // Ошибка при поднятии метрик не должна рушить приложение, просто логируем.
                Logger.warn('PrometheusMetrics server start failed:', err);
            }
        });

        PrometheusMetrics._instance = this;
    }

    /**
     * Увеличить счетчик.
     * @param {string} metricName
     * @param {number} [count=1]
     */
    inc(metricName, count = 1) {
        this._getCounter(metricName).inc(count);
    }

    /**
     * Установить значение метрики.
     * (в графиках будет отображено всегда последнее выставленное значение без агрегации)
     * @param {string} metricName
     * @param {number} value
     */
    set(metricName, value) {
        this._getGauge(metricName).set(value);
    }

    /**
     * Записать время.
     * @param {string} metricName
     * @param {number} time
     */
    recordTime(metricName, time) {
        this._getHistogram(metricName).observe(time);
    }

    /**
     * Начать замер времени, возвращает функцию которую надо вызвать в конце замера.
     * @param {string} metricName
     * @returns {Function}
     */
    startTimer(metricName) {
        return this._getHistogram(metricName).startTimer();
    }

    _getCounter(metricName) {
        let counter = this._counters.get(metricName);

        if (!counter) {
            counter = new client.Counter({
                name: metricName,
                help: 'no help',
            });
            this._counters.set(metricName, counter);
        }

        return counter;
    }

    _getGauge(metricName) {
        let gauge = this._gauges.get(metricName);

        if (!gauge) {
            gauge = new client.Gauge({
                name: metricName,
                help: 'no help',
            });
            this._gauges.set(metricName, gauge);
        }

        return gauge;
    }

    _getHistogram(metricName) {
        let gouge = this._histograms.get(metricName);

        if (!gouge) {
            gouge = new client.Histogram({
                name: metricName,
                help: 'no help',
                buckets: [0.2, 0.5, 1, 2, 4],
            });
        }

        return gouge;
    }
}

module.exports = PrometheusMetrics;
