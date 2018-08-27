const jayson = require('jayson');

module.exports = {
    E400: [400, 'Bad Request'],
    E401: [401, 'Unauthorized'],
    E403: [403, 'Forbidden'],
    E404: [404, 'Not Found'],
    E406: [406, 'Not Acceptable'],
    E500: [500, 'Internal Server Error'],
    E503: [503, 'Service Unavailable'],
};

function convertErrorToRPC() {
    for (let key of Object.keys(module.exports)) {
        module.exports[key] = makeRPCErrorObject(...module.exports[key]);
    }
}

function makeRPCErrorObject(code, message) {
    return jayson.utils.response(jayson.server.prototype.error(code, message));
}

convertErrorToRPC();
module.exports.makeRPCErrorObject = makeRPCErrorObject;
