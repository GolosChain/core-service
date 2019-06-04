const env = require('../data/env');

if (env.GLS_LOCAL_METRICS) {
    module.exports = require('./LocalMetrics').get(env.GLS_LOCAL_METRICS);
} else {
    module.exports = require('./PrometheusMetrics').get();
}
