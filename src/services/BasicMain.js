const Basic = require('./Basic');
const MongoDB = require('../services/MongoDB');
const Logger = require('../utils/Logger');
const metrics = require('../utils/metrics');

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
 * Метод boot запускается автоматически на старте,
 * перед запуском вложенных сервисаов.
 */
class BasicMain extends Basic {
    constructor(env = null) {
        super();

        if (env) {
            this.printEnvBasedConfig(env);
        }

        this.stopOnExit();
        this.throwOnUnhandledPromiseRejection();

        this._startMongoBeforeBoot = false;
        this._mongoDbForceConnectString = null;
        this._mongoDbOptions = {};
    }

    async start() {
        await this._tryStartMongoBeforeBoot();
        await this.boot();
        await this.startNested();
        this._tryIncludeMongoToNested();

        metrics.inc('service_start');
    }

    async stop() {
        await this.stopNested();

        metrics.inc('service_stop');
        process.exit(0);
    }

    /**
     * @deprecated
     */
    defineMeta() {
        Logger.warn('Define meta is deprecated');
    }

    /**
     * Подключит и запустит сервис работы
     * с базой данных MongoDB до запуска метода boot.
     * @param {string/null} [forceConnectString] Строка подключения,
     * не обязательна.
     * @param {Object} [options] Настройки подключения.
     */
    startMongoBeforeBoot(forceConnectString, options) {
        this._mongoDb = new MongoDB();
        this._startMongoBeforeBoot = true;
        this._mongoDbForceConnectString = forceConnectString;
        this._mongoDbOptions = options;
    }

    async _tryStartMongoBeforeBoot() {
        if (this._startMongoBeforeBoot) {
            Logger.info(`Start MongoDB...`);
            await this._mongoDb.start(this._mongoDbForceConnectString, this._mongoDbOptions);
            Logger.info(`The MongoDB done!`);

            this._tryExcludeMongoFromNested();
        }
    }

    _tryExcludeMongoFromNested() {
        this._nestedServices = this._nestedServices.filter(service => {
            if (service instanceof MongoDB) {
                Logger.warn('Exclude MongoDB from nested services - startMongoBeforeBoot used');
                return false;
            } else {
                return true;
            }
        });
    }

    _tryIncludeMongoToNested() {
        if (this._startMongoBeforeBoot) {
            this._nestedServices.unshift(this._mongoDb);
        }
    }
}

module.exports = BasicMain;
