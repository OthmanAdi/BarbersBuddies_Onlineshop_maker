// src/utils/logger.js
// Development-only logging utility - logs are disabled in production builds

const isDev = process.env.NODE_ENV === 'development';

export const devLog = (...args) => {
    if (isDev) {
        console.log(...args);
    }
};

export const devWarn = (...args) => {
    if (isDev) {
        console.warn(...args);
    }
};

// Always log errors (useful for production debugging)
export const logError = console.error;

export default { devLog, devWarn, logError };
