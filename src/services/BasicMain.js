const Basic = require('./Basic');

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
    }

    async start() {
        await this.startNested();
        this._stats.increment('main_service_start');
    }

    async stop() {
        await this.stopNested();
        this._stats.increment('main_service_stop');
        process.exit(0);
    }
}

module.exports = BasicMain;
