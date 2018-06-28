const WebSocket = require('ws');
const env = require('../Env');
const logger = require('../Logger');
const stats = require('../Stats').client;
const BasicService = require('../service/Basic');

// TODO remove after golos-js implement this methods
const MAGIC_SUBSCRIBE_CALL =
    '{"id":1,"jsonrpc":"2.0","method":"call","params":["database_api","set_block_applied_callback",[0]]}';

/**
 * Сервис подписки получения новых блоков.
 * Подписывается на рассылку блоков от golos-ноды, адрес которой определяется
 * переменной окружения. Каждый полученный блок сериализует и передает
 * в указанный callback. Имеет встроенную систему выброса ошибки по таймауту.
 *
 * На данный момент подключается напрямую, в обход golos-js т.к. необходимые
 * методы ещё не реализованны.
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
     * каждого нового блока.
     * @returns {Promise<void>} Промис без экстра данных.
     */
    async start(callback) {
        this._socket = new WebSocket(env.BLOCKCHAIN_NODE_ADDRESS);

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

            return callback(response.result);
        });
        this._socket.on('open', () => {
            logger.info('BlockSubscribe websocket connection established.');
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
        }, env.BLOCKCHAIN_SUBSCRIBE_TIMEOUT / 2);
    }

    _handleError(error) {
        stats.increment('block_subscribe_error');
        logger.error(`BlockSubscribe websocket error - ${error}`);
        process.exit(1);
    }
}

module.exports = BlockSubscribe;
