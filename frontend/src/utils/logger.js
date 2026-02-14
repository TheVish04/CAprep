/**
 * Minimal frontend logger: no-ops in production, forwards to console in development.
 * Use this for client-side logging so production builds don't emit logs.
 */
const isDev = import.meta.env?.DEV ?? (process.env.NODE_ENV === 'development');

const noop = () => {};

const logger = {
  info: isDev ? (...args) => console.log(...args) : noop,
  warn: isDev ? (...args) => console.warn(...args) : noop,
  error: isDev ? (...args) => console.error(...args) : noop,
  debug: isDev ? (...args) => console.debug(...args) : noop,
};

export default logger;
