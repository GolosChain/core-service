const fetch = require('node-fetch');
const env = require('../data/env');
const globalData = require('../data/data');

const ALLOWED_TYPES = ['warning', 'error', 'danger'];

/**
 * Send alert message.
 *
 * @param {'warning'|'error'|'danger'} [type] (default: 'warning')
 * @param {string} title
 * @param {string} text
 * @param {string} [prefix]
 * @param {string} [suffix]
 * @param {number} [timestamp]
 */

function sendAlert({ type = 'warning', title, text, prefix, suffix, timestamp }) {
    if (!ALLOWED_TYPES.includes(type)) {
        throw new Error('Invalid type');
    }

    if (!env.GLS_SLACK_ALERT_WEB_HOOK) {
        return;
    }

    if (type === 'error') {
        type = 'danger';
    }

    _sendAlert({ type, title, text, prefix, suffix, timestamp }).catch(err => {
        Logger.warn('Sending alert failed:', err);
    });
}

async function _sendAlert({ type, title, text, prefix, suffix, timestamp }) {
    const data = {
        text: `${prefix || ''}Service "${globalData.serviceName || 'unknown'}${suffix || ''}"`,
        attachments: [
            {
                color: type,
                title,
                text,
                ts: timestamp || Date.now(),
            },
        ],
    };

    const response = await fetch(env.GLS_SLACK_ALERT_WEB_HOOK, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });

    if (!response.ok) {
        throw new Error(`Sending alert failed: ${response.status}, ${response.statusText}`);
    }
}

module.exports = {
    sendAlert,
};
