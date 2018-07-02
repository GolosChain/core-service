const logger = require('./Logger');
const stats = require('./Stats');

class GateUtils {
    static serializeMessage(data) {
        let result;

        try {
            result = JSON.stringify(data);
        } catch (error) {
            stats.increment('gate_serialization_error');
            logger.error(`Gate serialization error - ${error}`);
            process.exit(1);
        }

        return result;
    }

    static deserializeMessage(message) {
        let data;

        try {
            data = JSON.parse(message);
        } catch (error) {
            return { error };
        }

        return data;
    }

    static noop() {
        // just empty function
    }
}

module.exports = GateUtils;
