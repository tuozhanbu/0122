const writeConsole = (level, args) => {
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

const normalizeConsoleError = (error) => ({
    name: error.name,
    message: error.message,
    stack: error.stack,
});

const normalizeConsolePayload = (payload) => {
    if (payload === undefined) {
        return undefined;
    }

    if (payload instanceof Error) {
        return { error: normalizeConsoleError(payload) };
    }

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return payload;
    }

    return Object.fromEntries(
        Object.entries(payload).map(([key, value]) => [
            key,
            value instanceof Error ? normalizeConsoleError(value) : value,
        ]),
    );
};

const createTaggedLogger = (tag) => {
    const normalizedTag = String(tag ?? '').trim() || 'App';
    const label = `[${normalizedTag}]`;
    const write = (level, message, payload) => {
        if (!__DEV__) {
            return;
        }

        const consolePayload = normalizeConsolePayload(payload);
        const args = consolePayload === undefined
            ? [label, message]
            : [label, message, consolePayload];
        writeConsole(level, args);
    };

    return {
        debug: (message, payload) => write('log', message, payload),
        info: (message, payload) => write('log', message, payload),
        warn: (message, payload) => write('warn', message, payload),
        error: (message, payload) => write('error', message, payload),
    };
};

export const createLogger = (tag) => createTaggedLogger(tag);

export const createDebugLogger = (tag) => createTaggedLogger(tag);
