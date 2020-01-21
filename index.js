const Controller = require('./src/controllers/Controller');

const Service = require('./src/services/Service');
const BasicMainService = require('./src/services/BasicMain');
const MongoDBService = require('./src/services/MongoDB');
const ConnectorService = require('./src/services/Connector');
const BlockSubscribe = require('./src/services/BlockSubscribe');

const UtilsLogger = require('./src/utils/Logger');
const UtilsMoments = require('./src/utils/Moments');
const UtilsTemplate = require('./src/utils/Template');
const UtilsRpcObject = require('./src/utils/RpcObject');
const UtilsContent = require('./src/utils/Content');
const utilsDefaultStarter = require('./src/utils/defaultStarter');
const UtilsGateClient = require('./src/utils/GateClient');
const UtilsGenesisProcessor = require('./src/utils/GenesisProcessor');
const UtilsParallel = require('./src/utils/Parallel');
const UtilsBulkSaver = require('./src/utils/BulkSaver');
const UtilsUserRegister = require('./src/utils/UserRegister');
const utilsMetrics = require('./src/utils/metrics');
const UtilsParallelPool = require('./src/utils/ParallelPool');
const utilsWaitForTransaction = require('./src/utils/waitForTransaction');
const UtilsCyberWayClient = require('./src/utils/CyberWayClient');

const TypesBigNum = require('./src/types/BigNum');
const TypesMongoBigNum = require('./src/types/MongoBigNum');

const dataEnv = require('./src/data/env');
const globalData = require('./src/data/data');

// Export public classes
module.exports = {
    controllers: {
        Controller,
        Basic: Controller, // For backward compatibility
    },
    services: {
        Service,
        Basic: Service, // For backward compatibility
        BasicMain: BasicMainService,
        BlockSubscribe,
        MongoDB: MongoDBService,
        Connector: ConnectorService,
    },
    utils: {
        Logger: UtilsLogger,
        Moments: UtilsMoments,
        Template: UtilsTemplate,
        RpcObject: UtilsRpcObject,
        Parallel: UtilsParallel,
        ParallelPool: UtilsParallelPool,
        BulkSaver: UtilsBulkSaver,
        Content: UtilsContent,
        defaultStarter: utilsDefaultStarter,
        GateClient: UtilsGateClient,
        GenesisProcessor: UtilsGenesisProcessor,
        metrics: utilsMetrics,
        UserRegister: UtilsUserRegister,
        waitForTransaction: utilsWaitForTransaction,
        CyberWayClient: UtilsCyberWayClient,
    },
    types: {
        BigNum: TypesBigNum,
        MongoBigNum: TypesMongoBigNum,
    },
    data: {
        env: dataEnv,
    },
    setServiceName(serviceName) {
        globalData.serviceName = serviceName;
    },
};
