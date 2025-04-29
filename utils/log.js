import { Logging } from '@google-cloud/logging';

const logging = new Logging();

/**
 * Write a structured log entry to a named Google Cloud log.
 *
 * @param {Object} options
 * @param {string} options.logName     - Custom log name (e.g. 'token-refresh-log').
 * @param {string} options.severity    - One of: 'DEFAULT', 'DEBUG', 'INFO', 'NOTICE', 'WARNING', 'ERROR', 'CRITICAL', 'ALERT', 'EMERGENCY'.
 * @param {string} options.event       - Short identifier for this log event (e.g. 'TokenRefreshed').
 * @param {string} [options.component] - Where this log originated (e.g. 'TokenHandler', 'FreeAgentAPI').
 * @param {string} [options.userId]    - Optional user ID (for filtering).
 * @param {string} [options.message]   - Human-readable message.
 * @param {object} [options.data={}]   - Extra structured data to include.
 */
export async function writeLog({
  logName,
  severity,
  event,
  component,
  userId,
  message,
  data = {}
}) {
  const log = logging.log(logName);

  const metadata = {
    severity,
    resource: {
      type: 'cloud_function'
    }
  };

  const payload = {
    event,
    component,
    userId,
    message,
    ...data,
    timestamp: new Date().toISOString()
  };

  const entry = log.entry(metadata, payload);

  try {
    await log.write(entry);
  } catch (err) {
    // fallback to console so you don’t lose logs if something breaks
    console.error(`[writeLog failed]`, err.message, { logName, severity, event });
  }
}