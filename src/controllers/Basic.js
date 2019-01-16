const Logger = require('../utils/Logger');

/**
 * Базовый класс для контроллеров.
 * Предоставляет общую логику для контроллеров приложения.
 * Поддерживает базовый интерфейс контроллеров.
 * Конструктор может опционально принимать коннектор,
 * который позволяет использовать шот-кат метод sendTo,
 * проксируя вызов через себя, который позволяет общаться
 * с другими микросервисами.
 */
class Basic {
    /**
     * Конструктор
     * @param {Object} [options] Настройки контроллера.
     * @param {Object} [options.connector] Произвольный инстанс класса коннектора,
     * предполагается что это Connector для общения между микросервисами,
     * но им может быть и любой другой класс, имплементирующий схожий интерфейс.
     */
    constructor({ connector } = {}) {
        if (connector) {
            this.connector = connector;
        }
    }

    /**
     * @property {Object} connector Создается конструктором, смотри описание.
     */

    /**
     * Базовый метод любого контроллера, являющийся дефолтной входной точкой.
     * @return {Promise<void>}
     */
    async handle() {
        throw 'Not implemented';
    }

    /**
     * Шот-кат метод для работы с коннектором, в базовом представлении
     * отправляет сообщение другому микросервису, но по своей сути
     * просто вызывает аналогичный метод у коннектора из конструктора,
     * при его наличии.
     * @param args Произвольные аргументы.
     * @return {Promise<*>} Ответ.
     */
    async sendTo(...args) {
        if (this.connector) {
            return await this.connector.sendTo(...args);
        } else {
            Logger.error('Basic controller - connector not defined');
            throw 'Connector not defined';
        }
    }

    async callService(service, method, params) {
        const response = await this.sendTo(service, method, params);

        if (response.error) {
            throw response.error;
        }

        return response.result;
    }
}

module.exports = Basic;
