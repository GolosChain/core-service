const template = require('lodash.template');

/**
 * Класс работы с шаблонами.
 * Использует lodash.template для генерации шаблонов.
 */
class Template {
    /**
     * Создает объект шаблона из строки.
     * Результат можно вызвать ещё раз передав параметры
     * для подстановки. Детально можно посмотреть в
     * документации Lodash для метода template.
     * @param {string} string Строка-шаблон.
     * @returns {Function} Шаблон-функция.
     */
    static make(string) {
        return template(string);
    }

    /**
     * Аналог метода make, но создает шаблоны для
     * строк внутри объекта, обходя его рекурсивно,
     * заменяя оригинальные строки на шаблоны-функции.
     * Предполагается что вложенные объекты являются объектами
     * или поддерживают Object.keys(inner).
     * @param {Object} object Целевой объект.
     * @returns {Object} object Целевой объект.
     */
    static makeFor(object) {
        for (let key of Object.keys(object)) {
            if (typeof object[key] === 'string') {
                object[key] = this.make(object[key]);
            } else {
                this.makeFor(object[key]);
            }
        }

        return object;
    }
}

module.exports = Template;
