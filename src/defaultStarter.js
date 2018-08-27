const Logger = require('./utils/Logger');

module.exports = (Main) => {
    new Main().start().then(
        () => {
            Logger.info('Main service started!');
        },
        error => {
            Logger.error(`Main service failed - ${error}`);
            process.exit(1);
        }
    );
};