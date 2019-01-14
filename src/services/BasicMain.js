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
        await this.startNested();
        const serviceName = ServiceMeta.get('name') || 'service';
        this._stats.increment(`${serviceName}:main_service_start`);
    }

    async stop() {
        await this.stopNested();
        const serviceName = ServiceMeta.get('name') || 'service';
        this._stats.increment(`${serviceName}:main_service_stop`);
        process.exit(0);
    }

    defineMeta(meta) {
        for (const key of Object.keys(meta)) {
            ServiceMeta.set(key, meta[key]);
        }
    }
}

module.exports = BasicMain;
