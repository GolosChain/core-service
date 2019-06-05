const env = require('../data/env');

let instance = null;

if (env.GLS_LOCAL_METRICS) {
    const Metrics = require('./LocalMetrics');

    instance = new Metrics({
        type: env.GLS_LOCAL_METRICS,
    });
} else {
    const Metrics = require('./PrometheusMetrics');

    instance = new Metrics();
}

module.exports = instance;
