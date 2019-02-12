const sanitizer = require('sanitize-html');

/**
 * Утилита для работы с контентом.
 */
class Content {
    /**
     * Очистить текст контента от лишних тегов.
     * Также заменяет тег H1 на H2 для более адекватного SEO.
     * @param {string} text Целевой текст.
     * @return {string} Результат.
     */
    sanitize(text) {
        return sanitizer(text, {
            allowedTags: [
                'h1',
                'h2',
                'h3',
                'h4',
                'h5',
                'h6',
                'blockquote',
                'p',
                'a',
                'ul',
                'ol',
                'nl',
                'li',
                'b',
                'i',
                'strong',
                'em',
                'strike',
                'code',
                'hr',
                'br',
                'div',
                'caption',
                'pre',
            ],
            transformTags: {
                h1: 'h2',
            },
        });
    }

    /**
     * Очищает текст для соответствия виду превью - удаляет все теги,
     * умно обрезает до нужной длинны и умно добавляет в конце троеточие.
     * @param {string} text Целевой текст.
     * @param {number} maxSize Максимальная длина результирующей строки.
     * @return {string} Результат.
     */
    sanitizePreview(text, maxSize) {
        const sanitized = sanitizer(text, {
            allowedTags: [],
        });

        return this.smartTrim(sanitized, maxSize);
    }

    /**
     * Умно обрезает строку до нужной длинны и умно добавляет в конце троеточие.
     * @param {string} text Целевой текст.
     * @param {number} maxSize Максимальная длина результирующей строки.
     * @return {string} Результат.
     */
    smartTrim(text, maxSize) {
        if (text.length <= maxSize) {
            return text.trim();
        }

        const hardTrim = this.hardTrim(text, maxSize);
        const softTrim = this.softTrimByDot(hardTrim);

        return this.makeEllipses(softTrim);
    }

    /**
     * Пытается умно обрезать строку до нужной длинны по точке.
     * @param {string} text Целевой текст.
     * @param {number} tolerance Уровень толлерантности при фильтрации.
     * @return {string} Результат.
     */
    softTrimByDot(text, tolerance = 0.86) {
        const dotIndex = text.lastIndexOf('. ');
        const softLimit = Math.round(text.length * tolerance);

        if (dotIndex > softLimit) {
            return text.substring(0, dotIndex + 1).trim();
        } else {
            return text.trim();
        }
    }

    /**
     * Жестко обрезает строку по лимиту
     * и зачищает лишние пустые символы по краям.
     * @param {string} text Целевой текст.
     * @param {number} maxSize Максимальная длина результирующей строки.
     * @return {string} Результат.
     */
    hardTrim(text, maxSize) {
        return text
            .trim()
            .substring(0, maxSize)
            .trim();
    }

    /**
     * Умно добавляет в конец строки троеточие.
     * @param {string} text Целевой текст.
     * @return {string} Результат.
     */
    makeEllipses(text) {
        return text.replace(/[,!?]?\s+[^\s]+$/, '…');
    }
}

module.exports = Content;
