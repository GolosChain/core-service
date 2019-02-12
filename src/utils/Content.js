const sanitizer = require('sanitize-html');

class Content {
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

    sanitizePreview(text, maxSize) {
        const sanitized = sanitizer(text, {
            allowedTags: [],
        });

        return this.smartTrim(sanitized, maxSize);
    }

    smartTrim(text, maxSize) {
        if (text.length <= maxSize) {
            return text;
        }

        const hardTrim = this.hardTrim(text, maxSize);
        const softTrim = this.softTrimByDot(hardTrim);

        return this.makeEllipses(softTrim);
    }

    softTrimByDot(text) {
        const dotIndex = text.lastIndexOf('. ');
        const softLimit = Math.round(text.length * 0.86);

        if (dotIndex > softLimit) {
            return text.substring(0, dotIndex + 1);
        } else {
            return text;
        }
    }

    hardTrim(text, maxSize) {
        return text.substring(0, maxSize).trim();
    }

    makeEllipses(text) {
        return text.replace(/[,!?]?\s+[^\s]+$/, '…');
    }
}

module.exports = Content;
