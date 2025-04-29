import { Logging } from '@google-cloud/logging';
import path from 'path';
import { fileURLToPath } from 'url';

const logging = new Logging();

/**
 * Write a structured log entry to a named Google Cloud log.
 *
 * @param {Object} options
 * @param {string} options.logName     - Custom log name (e.g. 'token-refresh-log').
 * @param {string} options.severity    - One of: 'DEFAULT', 'DEBUG', 'INFO', etc.
 * @param {string} options.functionName    - The function that the log is from.
 * @param {string} options.event       - Short identifier for this log event.
 * @param {object} [options.data={}]   - Extra structured data to include.
 */
export async function writeLog({
  logName,
  severity,
  functionName,
  event,
  data = {}
}) {
  const log = logging.log(logName);

  let file = 'unknown';
  let line = null;

  try {
    const err = new Error();
    const stackLines = err.stack?.split('\n');
    if (stackLines && stackLines.length > 2) {
      const match = stackLines[2].match(/\(([^)]+):(\d+):(\d+)\)/) || stackLines[2].match(/at ([^ ]+):(\d+):(\d+)/);
      if (match) {
        file = path.basename(match[1]);
        line = parseInt(match[2], 10);
      }
    }
  } catch (e) {
    // fallback to unknown
  }

  const metadata = {
    severity,
    resource: {
      type: 'cloud_function'
    }
  };

  const payload = {
    event,
    functionName: functionName || 'unknown - add it in Big!',
    file,
    line,
    ...data,
    timestamp: new Date().toISOString()
  };

  const entry = log.entry(metadata, payload);

  try {
    await log.write(entry);
  } catch (err) {
    console.error('[writeLog failed]', err.message, { logName, severity, event });
  }
}