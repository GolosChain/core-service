const EventEmitter = require('events');
const logger = require('../utils/Logger');
const env = require('../env');

/**
 * Базовый сервис, выступающий в роле абстрактного сервиса с частью уже
 * реализованных методов. Предполагается использование только через
 * наследование.
 *
 * Содержит метод запуска, который непосредственно запускает сервис, отдельно
 * от конструктора. Одна из причин подобного разделения - сервис может
 * запускать бесконечные циклы, исполняемые в нужные промежутки времени.
 * Соответственно содержит метод остановки, который зачищает за собой всё
 * что необходимо, останавливает циклы, являясь неким деструктором, безопасно
 * завершая сервис. Дополнительно предусмотрен метод восстановления сервиса,
 * который восстанавливает стейт после сбоя, воссоздавая то что нужно или
 * уничтожая не валидное. Также предусмотрен метод повторной попытки выполнения
 * действия. Для сервисов, которые являются конечными и могут быть завершены
 * явно - предусмотрен односторонний механизм установки состояния сервиса в
 * завершенное состояние, а также метод проверки этого.
 *
 * Для организации бесконечных или условно конечных циклов предусмотрен
 * механизм исполнения итераций, который вызывает соответствующий метод
 * каждый указанный промежуток времени, при этом с возможностью переопределить
 * время старта первой итерации т.к. бывает необходимость запустить её через
 * совсем иное время или же сразу. Также присутствует метод остановки
 * итератора.
 *
 * Сервисы могут содержать вложенные сервисы, которые хранятся в
 * специализированной коллекции. Также присутствуют методы для запуска
 * и остановки вложенных сервисов, которые в свою очередь могут содержать
 * свои собственные вложенные сервисы, что позволяет организовывать
 * древовидную архитектуру зависимых сервисов и автоматически включать и
 * выключать необходимые ветви. При этом этот процесс может быть асинхронным.
 *
 * Вложенные сервисы останавливаются в обратном порядке относительно запуска.
 *
 * Дополнительно предусмотренна установка сервиса в режим автоотключения
 * при завершении процесса по сигналу SIGINT (Ctrl-C и прочее).
 *
 * Каждый сервис снабжен эмиттером эвентов, являющимся инстансом
 * стандарнтого EventEmitter от NodeJS. Для удобства имеются методы-шоткаты
 * emit и on, для других действий с эвентами необходимо напрямую использовать
 * интсанс, получаемый по getEmitter(). Также возможно транслировать эвенты
 * из других объектов через себя.
 */
class Basic {
    constructor() {
        this._nestedServices = [];
        this._done = false;

        this._emitter = new EventEmitter();
    }

    /**
     * Проверка сервиса на факт завершенности.
     * @returns {boolean} Результат проверки.
     */
    isDone() {
        return this._done;
    }

    /**
     * Пометка сервиса как завершенного.
     */
    done() {
        this._done = true;
    }

    /**
     * Абстрактный метод старта сервиса.
     * @returns {Promise<void>} Промис без экстра данных.
     */
    async start() {
        throw 'No service start logic';
    }

    /**
     * Абстрактный метод остановки сервиса, не требудет необходимости
     * в имплементации.
     * @returns {Promise<void>} Промис без экстра данных.
     */
    async stop() {
        logger.log(`No extra stop logic for service ${this.constructor.name}`);
    }

    /**
     * Абстрактный метод восстановления сервиса, не требует необходимости
     * в имплементации.
     * @returns {Promise<void>} Промис без экстра данных.
     */
    async restore() {
        logger.log(`No restore logic for service ${this.constructor.name}`);
    }

    /**
     * Абстракнтный метод повторной попытки совершения действия.
     * @returns {Promise<void>} Промис без экстра данных.
     */
    async retry() {
        throw 'No retry logic';
    }

    /**
     * Добавляет 1 или более сервисов в зависимость к этому сервису.
     * @param {Basic} services Сервисы.
     */
    addNested(...services) {
        this._nestedServices.push(...services);
    }

    /**
     * Запускает все зависимые сервисы.
     * @returns {Promise<void>} Промис без экстра данных.
     */
    async startNested() {
        logger.info('Start services...');

        for (let service of this._nestedServices) {
            logger.info(`Start ${service.constructor.name}...`);
            await service.start();
            logger.info(`The ${service.constructor.name} done!`);
        }

        logger.info('Start services done!');
    }

    /**
     * Останавливает все зависимые сервисы.
     * @returns {Promise<void>} Промис без экстра данных.
     */
    async stopNested() {
        logger.info('Cleanup...');

        for (let service of this._nestedServices.reverse()) {
            logger.info(`Stop ${service.constructor.name}...`);

            if (!service.isDone()) {
                await service.stop();
            }

            logger.info(`The ${service.constructor.name} done!`);
        }

        logger.info('Cleanup done!');
    }

    /**
     * Устанавливает обработчик на сигнал SIGINT (Ctrl-C и прочее),
     * который вызывает метод stop.
     */
    stopOnExit() {
        process.on('SIGINT', this.stop.bind(this));
    }

    /**
     * Итерация сервиса в случае если сервис является циклическим.
     * @returns {Promise<void>} Промис без экстра данных.
     */
    async iteration() {
        throw 'Empty iteration body';
    }

    /**
     * Запускает итератор сервиса.
     * @param {number} [firstIterationTimeout] Отсрочка запуска первой итерации.
     * @param {number} [interval] Интервал между запусками итераций.
     */
    startLoop(firstIterationTimeout = 0, interval = Infinity) {
        setTimeout(async () => {
            await this.iteration();
            this._loopId = setInterval(this.iteration.bind(this), interval);
        }, firstIterationTimeout);
    }

    /**
     * Останавливает итератор, при этом если какая-то итерация находится
     * в процессе выполнения - она продолжит выполнение, но новые итерации
     * запущенны не будут.
     */
    stopLoop() {
        clearInterval(this._loopId);
    }

    /**
     * Распечатывает конфигурацию микросервиса, устанавливаемую через
     * ENV-переменые. Конфигурация корневых классов будет распечатана
     * автоматически, для распечатки конфигурации самого микросервиса
     * необходимо передать объект env-модуля в параметры метода.
     * @param {Object} [serviceEnv] Модуль конфигурации уровня микросервиса.
     */
    printEnvBasedConfig(serviceEnv = {}) {
        logger.info('ENV-based config:');
        logger.info('Core config params:');
        logger.info('---');

        for (let key of Object.keys(env)) {
            logger.info(`${key} = ${env[key]}`);
        }

        logger.info('---');
        logger.info('Service config params:');
        logger.info('---');

        for (let key of Object.keys(serviceEnv)) {
            logger.info(`${key} = ${serviceEnv[key]}`);
        }

        logger.info('---');
    }

    /**
     * Эмиттер событий сервиса, необходим для подписки на события.
     * Возвращаемый инстранс эмиттера является стандартным
     * эмиттером NodeJS.
     * @returns {EventEmitter} Эмиттер событий сервиса.
     */
    getEmitter() {
        return this._emitter;
    }

    /**
     * Шоткат для запуска эвента.
     * Запускает эвент с указанным именем.
     * Данные, при необходимости, можно передать аргментами
     * через запятую.
     * @param {string/Symbol} name Имя события.
     * @param {...any} [data] Данные.
     */
    emit(name, ...data) {
        this._emitter.emit(name, ...data);
    }

    /**
     * Трансляция эвентов целевого объекта через себя.
     * @param {any} from Эмиттер, эвенты которого необходимо транслировать.
     * @param {...string/...Symbol} events Список эвентов.
     */
    translateEmit(from, ...events) {
        for (let event of events) {
            from.on(event, (...args) => this.emit(event, ...args));
        }
    }

    /**
     * Подписка на эвент с указанным именем.
     * @param {string/Symbol} name Имя эвента.
     * @param {Function} callback Колбек.
     */
    on(name, callback) {
        this._emitter.on(name, callback);
    }
}

module.exports = Basic;
