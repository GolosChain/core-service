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
        golos.api.setBlockAppliedCallback('full', (error, data) => {
            if (error) {
                throw error;
            }

            const blockNum = this._extractBlockNum(data);

            callback(data, blockNum);
        });
    }

    _extractBlockNum(data) {
        const previousHash = data.previous;
        const previousBlockNum = parseInt(previousHash.slice(0, 8), 16);

        return previousBlockNum + 1;
    }
}

module.exports = BlockSubscribe;
