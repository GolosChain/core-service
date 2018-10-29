const golos = require('golos-js');
const BigNum = require('./BigNum');

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
        golos = new BigNum(golos);

        const { total_vesting_fund_steem, total_vesting_shares } = globalProperties;
        const totalVestingFundSteem = new BigNum(total_vesting_fund_steem);
        const totalVestingShares = new BigNum(total_vesting_shares);
        const vests = golos.div(totalVestingFundSteem.div(totalVestingShares));

        return vests.dp(6);
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
        vests = new BigNum(vests);

        const { total_vesting_fund_steem, total_vesting_shares } = globalProperties;
        const totalVestingFundSteem = new BigNum(total_vesting_fund_steem);
        const totalVestingShares = new BigNum(total_vesting_shares);
        const golos = totalVestingFundSteem.times(vests.div(totalVestingShares));

        return golos.dp(3);
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
