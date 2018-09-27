const BasicService = require('./Basic');
const golos = require('golos-js');
const BlockUtils = require('../utils/Block');

// TODO Make 'fork' event
/**
 * Сервис подписки получения новых блоков.
 * Подписывается на рассылку блоков от golos-ноды.
 * Каждый полученный блок сериализует и передает в эвенте
 * 'block', а в случае форка вызывается эвент 'fork'.
 * Альтернативно для получения данных блока можно
 * использовать callback-функцию.
 */
class BlockSubscribe extends BasicService {
    /**
     * Вызывается в случае получения нового блока из блокчейна.
     * @event block
     * @property {Object} block Блок данных.
     * @property {number} blockNum Номер блока.
     */

    /**
     * Вызывается в случае обнаружения форка, оповещает о номере блока,
     * с которого начинаются расхождения.
     * @event fork
     * @property {number} blockNum Номер блока.
     */

    /**
     * Запуск.
     * @param {Function} callback Альтернтативный способ получения данных блока,
     * повторяет апи эвента 'block'.
     * @returns {Promise<void>} Промис без экстра данных.
     */
    async start(callback = null) {
        golos.api.setBlockAppliedCallback('full', (error, block) => {
            if (error) {
                throw error;
            }

            const blockNum = BlockUtils.extractBlockNum(block);

            this.emit('block', block, blockNum);
            callback(block, blockNum);
        });
    }
}

module.exports = BlockSubscribe;
