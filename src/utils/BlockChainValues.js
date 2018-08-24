const golos = require('golos-js');

/**
 * Класс утилит работы со значениями из блокчейна.
 */
class BlockChainValues {
    /**
     * Конвертация значения голоса в значение вестс
     * на основе динамических данных из блокчейна.
     * @param {number} golos Количество голосов.
     * @param {Object} globalProperties
     * Сырой объект глобальных свойств блокчейна
     * (можно получить из метода getDynamicGlobalProperties из этого же класса).
     * @returns {number} Результирующие значение.
     */
    static golosToVests(golos, globalProperties) {
        const { total_vesting_fund_steem, total_vesting_shares } = globalProperties;
        const totalVestingFundSteem = parseFloat(total_vesting_fund_steem);
        const totalVestingShares = parseFloat(total_vesting_shares);
        const vests = golos / (totalVestingFundSteem / totalVestingShares);

        return +vests.toFixed(6);
    }

    /**
     * Конвертация значения вестс в значение голоса
     * на основе динамических данных из блокчейна.
     * @param {number} vests Количество вестс.
     * @param {Object} globalProperties
     * Сырой объект глобальных свойств блокчейна
     * (можно получить из метода getDynamicGlobalProperties из этого же класса).
     * @returns {number} Результирующие значение.
     */
    static vestsToGolos(vests, globalProperties) {
        const { total_vesting_fund_steem, total_vesting_shares } = globalProperties;
        const totalVestingFundSteem = parseFloat(total_vesting_fund_steem);
        const totalVestingShares = parseFloat(total_vesting_shares);
        const golos = totalVestingFundSteem * (vests / totalVestingShares);

        return +golos.toFixed(3);
    }

    /**
     * Динамические свойства блокчейна на данным момент.
     * @returns {Promise<Object>} Сырой объект из блокчейна.
     */
    static async getDynamicGlobalProperties() {
        return await golos.api.getDynamicGlobalPropertiesAsync();
    }
}

module.exports = BlockChainValues;
