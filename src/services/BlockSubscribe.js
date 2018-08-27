const BasicService = require('./Basic');
const golos = require('golos-js');

/**
 * Сервис подписки получения новых блоков.
 * Подписывается на рассылку блоков от golos-ноды, адрес которой определяется
 * переменной окружения. Каждый полученный блок сериализует и передает
 * в указанный callback. Имеет встроенную систему выброса ошибки по таймауту.
 */
class BlockSubscribe extends BasicService {

    /**
     * Запуск, подписывается на новые блоки указанной golos-ноды
     * и переправляет все данные в сериализованном виде в указанный
     * callback.
     * @param {Function} callback Функция, которая будет получать данные
     * каждого нового блока. Первым аргументом идет блок, вторым - его номер.
     * @returns {Promise<void>} Промис без экстра данных.
     */
    async start(callback) {
        golos.api.setBlockAppliedCallback('full', callback);
    }
}

module.exports = BlockSubscribe;
