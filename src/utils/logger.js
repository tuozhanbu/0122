export const createLogger = (tag) => {
    const label = `[${String(tag ?? '').trim() || 'App'}]`;

    const write = (level, message, payload) => {
        if (!__DEV__) {
            return;
        }

        const args = payload === undefined ? [label, message] : [label, message, payload];
        if (level === 'error') {
            console.error(...args);
            return;
        }
        if (level === 'warn') {
            console.warn(...args);
            return;
        }
        console.log(...args);
    };

    return {
        debug: (message, payload) => write('log', message, payload),
        info: (message, payload) => write('log', message, payload),
        warn: (message, payload) => write('warn', message, payload),
        error: (message, payload) => write('error', message, payload),
    };
};
