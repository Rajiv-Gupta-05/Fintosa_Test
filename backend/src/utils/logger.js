const { createLogger, format, transports } = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

// ─── Custom formats ───────────────────────────────────────────────────────────

// Pretty console format: [TIMESTAMP] LEVEL  message  {meta}
const consoleFormat = format.combine(
  format.timestamp({ format: 'HH:mm:ss' }),
  format.colorize({ all: true }),
  format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length
      ? '\n  ' + JSON.stringify(meta, null, 2).replace(/\n/g, '\n  ')
      : '';
    return `[${timestamp}] ${level.padEnd(15)} ${message}${metaStr}`;
  })
);

// Structured JSON for log files (machine-readable)
const fileFormat = format.combine(
  format.timestamp(),
  format.errors({ stack: true }),
  format.json()
);

// ─── Logger instance ──────────────────────────────────────────────────────────
const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  transports: [
    // Console — colourised, human-readable
    new transports.Console({ format: consoleFormat }),

    // Rotating daily file for all info+ logs
    new transports.File({
      filename: path.join(logsDir, 'app.log'),
      format: fileFormat,
      maxsize: 5 * 1024 * 1024,  // 5 MB per file
      maxFiles: 7,                // keep 7 days
    }),

    // Separate file that only captures errors
    new transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      format: fileFormat,
      maxsize: 5 * 1024 * 1024,
      maxFiles: 14,
    }),
  ],
});

// ─── Convenience helpers ──────────────────────────────────────────────────────

/**
 * Log an HTTP request summary (used by the Morgan stream integration).
 */
logger.httpStream = {
  write: (message) => logger.http(message.trimEnd()),
};

/**
 * Attach request context (method, url, userId) to every log in a request scope.
 * Usage:  const log = logger.child({ reqId, userId, method, url });
 */
logger.forRequest = (req) => {
  return logger.child({
    reqId: req.id || '-',
    method: req.method,
    url: req.originalUrl,
    userId: req.user?._id?.toString() || 'anon',
    ip: req.ip || req.headers['x-forwarded-for'] || '-',
  });
};

module.exports = logger;
