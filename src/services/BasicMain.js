const Basic = require('./Basic');
const ServiceMeta = require('../utils/ServiceMeta');

/**
 * Базовый класс главного класса приложения.
 * Автоматически выполняет стандартные процедуры
 * запуска и остановки микросервиса, полученные
 * опытным путем на других микросервисах и ботах,
 * что убирает ненужный повторяющийся код.
 * Необходимо лишь описать конструктор, поместив
 * необходимые сервисы в nested-хранлище
 * (смотри addNested). Единственным нюансом
 * является необходимость отправки в конструктор
 * этого базового класса клиента StatsD.
 * Дополнительно можно отправить env-объект для
 * автоматической печати переменных env в консоль.
 * Метод boot запускается автоматически на статрте,
 * перед запуском вложенных сервисаов.
 */
class BasicMain extends Basic {
    constructor(stats, env = null) {
        super();

        if (env) {
            this.printEnvBasedConfig(env);
        }

        this._stats = stats;
        this.stopOnExit();
        this.throwOnUnhandledPromiseRejection();
    }

    async start() {
        await this.boot();
        await this.startNested();
        this._stats.increment(`${ServiceMeta.get('name')}:main_service_start`);
    }

    async stop() {
        await this.stopNested();
        this._stats.increment(`${ServiceMeta.get('name')}:main_service_stop`);
        process.exit(0);
    }

    /**
     * Метод установки метаданных микросервиса.
     * @param {Object} meta Любые необходимые данные (см. utils/ServiceMeta).
     */
    defineMeta(meta) {
        for (const key of Object.keys(meta)) {
            ServiceMeta.set(key, meta[key]);
        }
    }
}

module.exports = BasicMain;
