const WebSocket = require('ws');
const Logger = require('../utils/Logger');
const stats = require('../utils/statsClient');
const BasicService = require('./Basic');

const MAGIC_SUBSCRIBE_CALL =
    '{"id":1,"jsonrpc":"2.0","method":"call","params":["database_api","set_block_applied_callback",["full"]]}';

const BLOCKCHAIN_CONNECT = 'wss://ws.golos.io';
const BLOCKCHAIN_SUBSCRIBE_TIMEOUT = 60000;

/**
 * Сервис подписки получения новых блоков.
 * Подписывается на рассылку блоков от основной golos-ноды.
 * Каждый полученный блок сериализует и передает
 * в указанный callback. Имеет встроенную систему выброса ошибки по таймауту.
 *
 * Является альтернативным, старым, но стабильным способом подписки на блоки.
 */
class BlockSubscribe extends BasicService {
    constructor() {
        super();

        this._alive = false;
    }

    /**
     * Запуск, подписывается на новые блоки указанной golos-ноды
     * и переправляет все данные в сериализованном виде в указанный
     * callback.
     * @param {Function} callback Функция, которая будет получать данные
     * каждого нового блока. Первым аргументом идет блок, вторым - его номер.
     * @returns {Promise<void>} Промис без экстра данных.
     */
    async start(callback) {
        this._socket = new WebSocket(BLOCKCHAIN_CONNECT);

        this._makeSocketHandlers(callback);
        this._startSocketWatchDog();
    }

    /**
     * Остановка, уничтожает сокет подключения.
     * @returns {Promise<void>} Промис без экстра данных.
     */
    async stop() {
        this._socket.terminate();
    }

    _makeSocketHandlers(callback) {
        this._socket.on('error', this._handleError);
        this._socket.on('message', raw => {
            let response;

            this._alive = true;

            try {
                response = JSON.parse(raw);
            } catch (error) {
                this._handleError(error);
                return;
            }

            if (!response.result) {
                this._handleError('Empty message result');
                return;
            }

            const data = response.result;
            const blockNum = this._extractBlockNum(data);

            return callback(data, blockNum);
        });
        this._socket.on('open', () => {
            Logger.info('BlockSubscribe websocket connection established.');
            this._socket.send(MAGIC_SUBSCRIBE_CALL);
        });
    }

    _startSocketWatchDog() {
        const dog = setInterval(() => {
            if (!this._alive) {
                stats.increment('block_subscribe_timeout');
                clearInterval(dog);
                this._handleError('Request timeout');
            }

            this._alive = false;
        }, BLOCKCHAIN_SUBSCRIBE_TIMEOUT / 2);
    }

    _handleError(error) {
        stats.increment('block_subscribe_error');
        Logger.error(`BlockSubscribe websocket error - ${error.stack}`);
        process.exit(1);
    }

    _extractBlockNum(data) {
        const previousHash = data.previous;
        const previousBlockNum = parseInt(previousHash.slice(0, 8), 16);

        return previousBlockNum + 1;
    }
}

module.exports = BlockSubscribe;
