// Utility for logging messages on the server

const { format } = require('util');

// Setup local/in-memory log stores
const logs = {}; const printedLogs = []; const htmlLogs = [];

/**
 * A simple utility for parsing and storing logs. It can also print the logs optionally,
 * if `print = true`.
 * @param {string} source .
 * @param {string} level Log level (`info` | `error` | `debug` | `trace` | `warn` | `fatal`).
 * @param {object} entry Full log entry/technical details.
 * @param {string} message Log message.
 * @param {string[]} [details] Arguments/parameters to be inserted in message, if any.
 * @param {boolean} print Determines if mesage should also be printed in the console/terminal.
 */
function simpleLogger(level, entry, message, details = [], print = false) {
  // Create log entry
  const logEntry = {
    timestamp: new Date().toISOString(), // Add a timestamp
    message: format(message, ...details), // Add log message with details included if applicable
    unformattedMessage: { message, details }, // Add the original log message and message details
    ...entry, // Add original log entry object
  };
  if (logs[level]) logs[level].push(logEntry);
  else logs[level] = [logEntry];

  // Print to console if requested or message is an info or error
  const service = entry.service ? ` | ${entry.service}` : ''; // Name of function/service that created the log
  const sid = logEntry.sid ? `${logEntry.sid.padEnd(11, ' ')}` : service ? '' : ''.padEnd(11, '  ');
  const tnx = logEntry.tnx ? `${logEntry.tnx[0].toUpperCase()}: ` : '';
  const prefix = `[${logEntry.timestamp}] ${level.toUpperCase().padEnd(5)} [${sid}${service}] ${tnx}`;
  const logMessage = logEntry.message.replaceAll('\n', `\n${prefix}`);
  const log = `${prefix}${logMessage}`;
  if (print || ['fatal', 'error', 'info'].includes(level)) {
    if (console[level]) console[level](log);
    else console.log(log);
  }

  // Add current log to top of printedLogs and htmlLogs
  printedLogs.unshift({ timestamp: logEntry.timestamp, level, log });
  htmlLogs.unshift([htmlLogs.length + 1, logEntry.timestamp, level, `${sid}${service}`, logEntry.tnx || '',
    logEntry.message.replaceAll('\n', '<br>')]);
}

// Wrapper for simpleLogger to made it a standard Express/Node.js logger
const logger = {
  trace: (entry, message, ...args) => { simpleLogger('trace', entry, message, args); },
  info: (entry, message, ...args) => { simpleLogger('info', entry, message, args); },
  debug: (entry, message, ...args) => { simpleLogger('debug', entry, message, args); },
  warn: (entry, message, ...args) => { simpleLogger('warn', entry, message, args); },
  error: (entry, message, ...args) => { simpleLogger('error', entry, message, args); },
  fatal: (entry, message, ...args) => { simpleLogger('fatal', entry, message, args); },
};

module.exports = { logger, logs, printedLogs, htmlLogs, simpleLogger };
