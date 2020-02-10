const data = require('../data/data');
const Logger = require('../utils/Logger');

/**
 * Функция, выполняющая дефолтный запуск микросервиса,
 * достаточно лишь передать главный класс приложения.
 * Существует по причине полной аналогии способа запуска
 * все нынешних микросервисов на базе core.
 * @param {Basic} Main - главный класс приложения.
 * @param {string} [serviceName] - имя сервиса, используется для более точного логирования.
 */
module.exports = function(Main, serviceName) {
    if (serviceName) {
        data.serviceName = serviceName;
    }

    new Main().start().then(
        () => {
            Logger.info('Main service started!');
        },
        error => {
            Logger.error('Main service failed:', error);
            process.exit(1);
        }
    );
};
