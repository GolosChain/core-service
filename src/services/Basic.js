const EventEmitter = require('events');
const Logger = require('../utils/Logger');
const env = require('../data/env');

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
 *
 * Для удобства есть возможность указывать
 * асинхронную логику запуска в методе boot.
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
     * Старт сервиса.
     * @param {...*} [args] Аргументы.
     * @returns {Promise<void>} Промис без экстра данных.
     */
    async start(...args) {
        await this.startNested();
    }

    /**
     * Остановка сервиса.
     * @param {...*} [args] Аргументы.
     * @returns {Promise<void>} Промис без экстра данных.
     */
    async stop(...args) {
        await this.stopNested();
    }

    /**
     * Абстрактный метод восстановления сервиса, не требует необходимости
     * в имплементации.
     * @param {...*} [args] Аргументы.
     * @returns {Promise<void>} Промис без экстра данных.
     */
    async restore(...args) {
        // Do nothing
    }

    /**
     * Абстракнтный метод повторной попытки совершения действия.
     * @param {...*} [args] Аргументы.
     * @returns {Promise<void>} Промис без экстра данных.
     */
    async retry(...args) {
        // Do nothing
    }

    /**
     * Абстрактный асинхронный метод, который предполагается запускать
     * при старте сервиса для выполнения какой-либо асинхронной логики,
     * которую нельзя поместить в конструктор.
     * @returns {Promise<void>} Промис без экстра данных.
     */
    async boot() {
        // abstract
    }

    /**
     * Добавляет сервисы в зависимость к этому сервису.
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
        Logger.info('Start services...');

        for (let service of this._nestedServices) {
            Logger.info(`Start ${service.constructor.name}...`);
            await service.start();
            Logger.info(`The ${service.constructor.name} done!`);
        }

        Logger.info('Start services done!');
    }

    /**
     * Останавливает все зависимые сервисы.
     * @returns {Promise<void>} Промис без экстра данных.
     */
    async stopNested() {
        Logger.info('Cleanup...');

        for (let service of this._nestedServices.reverse()) {
            Logger.info(`Stop ${service.constructor.name}...`);

            if (!service.isDone()) {
                await service.stop();
            }

            Logger.info(`The ${service.constructor.name} done!`);
        }

        Logger.info('Cleanup done!');
    }

    /**
     * Устанавливает обработчик на сигнал SIGINT (Ctrl-C и прочее),
     * который вызывает метод stop.
     */
    stopOnExit() {
        process.on('SIGINT', this.stop.bind(this));
    }

    /**
     * Завершает процесс с ошибкой в случае обнаружения необработанного
     * реджекта/ошибки промиса.
     */
    throwOnUnhandledPromiseRejection() {
        process.on('unhandledRejection', error => {
            Logger.error('Unhandled promise rejection:', error);
            process.exit(1);
        });
    }

    /**
     * Итерация сервиса в случае если сервис является циклическим.
     * @param {...*} [args] Аргументы.
     * @returns {Promise<void>} Промис без экстра данных.
     */
    async iteration(...args) {
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
        Logger.info('ENV-based config:');
        Logger.info('Core config params:');
        Logger.info('---');

        for (let key of Object.keys(env)) {
            Logger.info(`${key} = ${env[key]}`);
        }

        Logger.info('---');
        Logger.info('Service config params:');
        Logger.info('---');

        for (let key of Object.keys(serviceEnv)) {
            Logger.info(`${key} = ${serviceEnv[key]}`);
        }

        Logger.info('---');
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
     * @param {...*} [data] Данные.
     */
    emit(name, ...data) {
        this._emitter.emit(name, ...data);
    }

    /**
     * Трансляция эвентов целевого объекта через себя.
     * @param {Object/Object[]} from Эмиттер, эвенты которого необходимо транслировать.
     * @param {...string/string/string[]} events Список эвентов.
     */
    translateEmit(from, ...events) {
        if (!Array.isArray(from)) {
            from = [from];
        }

        if (Array.isArray(events[0])) {
            events = events[0];
        }

        for (let target of from) {
            for (let event of events) {
                target.on(event, (...args) => this.emit(event, ...args));
            }
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

    /**
     * Подписка на эвент с указанным именем.
     * Исполняется один раз.
     * @param {string/Symbol} name Имя эвента.
     * @param {Function} callback Колбек.
     */
    once(name, callback) {
        this._emitter.once(name, callback);
    }
}

module.exports = Basic;
