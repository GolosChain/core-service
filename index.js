// Help for IDE class linking
const ControllersBasic = require('./src/controllers/Basic');

const ServicesBasic = require('./src/services/Basic');
const ServicesBasicMain = require('./src/services/BasicMain');
const ServicesBlockSubscribe = require('./src/services/BlockSubscribe');
const ServicesMongoDB = require('./src/services/MongoDB');
const ServicesConnector = require('./src/services/Connector');

const UtilsLogger = require('./src/utils/Logger');
const UtilsMoments = require('./src/utils/Moments');
const UtilsTemplate = require('./src/utils/Template');
const UtilsRpcObject = require('./src/utils/RpcObject');
const UtilsServiceMeta = require('./src/utils/ServiceMeta');
const UtilsContent = require('./src/utils/Content');
const utilsDefaultStarter = require('./src/utils/defaultStarter');
const UtilsGateClient = require('./src/utils/GateClient');
const UtilsParallel = require('./src/utils/Parallel');
const utilsMetrics = require('./src/utils/metrics');
const UtilsParallelPool = require('./src/utils/ParallelPool');
const TypesBigNum = require('./src/types/BigNum');
const TypesMongoBigNum = require('./src/types/MongoBigNum');

const dataEnv = require('./src/data/env');

// Export public classes
module.exports = {
    controllers: {
        Basic: ControllersBasic,
    },
    services: {
        Basic: ServicesBasic,
        BasicMain: ServicesBasicMain,
        BlockSubscribe: ServicesBlockSubscribe,
        MongoDB: ServicesMongoDB,
        Connector: ServicesConnector,
    },
    utils: {
        Logger: UtilsLogger,
        Moments: UtilsMoments,
        Template: UtilsTemplate,
        RpcObject: UtilsRpcObject,
        ServiceMeta: UtilsServiceMeta,
        Parallel: UtilsParallel,
        ParallelPool: UtilsParallelPool,
        Content: UtilsContent,
        defaultStarter: utilsDefaultStarter,
        GateClient: UtilsGateClient,
        metrics: utilsMetrics,
    },
    types: {
        BigNum: TypesBigNum,
        MongoBigNum: TypesMongoBigNum,
    },
    data: {
        env: dataEnv,
    },
};
