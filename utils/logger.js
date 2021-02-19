const log4js = require('log4js');
log4js.configure({
    appenders: { error: { type: 'file', filename: 'error.log' } },
    categories: { default: { appenders: ['error'], level: 'error' } }
});
const loggers = log4js.getLogger('error');
loggers.level = 'ERROR';

module.exports = loggers;
