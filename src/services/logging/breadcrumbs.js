import { MAX_CLIENT_ERROR_BREADCRUMBS } from '@/services/logging/clientErrors/constants';
import { sanitizeLogValue } from '@/services/logging/redaction/logEntries';

const BREADCRUMB_RUNTIME_STATE_KEY = '__APP_ERROR_BREADCRUMBS__';

const runtimeState = (() => {
    if (!globalThis[BREADCRUMB_RUNTIME_STATE_KEY]) {
        globalThis[BREADCRUMB_RUNTIME_STATE_KEY] = {
            entries: [],
        };
    }

    return globalThis[BREADCRUMB_RUNTIME_STATE_KEY];
})();

const normalizeBreadcrumb = ({ category, name, level = 'info', data = {} }) => ({
    time: new Date().toISOString(),
    category: String(category ?? 'app'),
    name: String(name ?? ''),
    level: String(level ?? 'info'),
    data: sanitizeLogValue(data),
});

export const recordBreadcrumb = (breadcrumb) => {
    const entry = normalizeBreadcrumb(breadcrumb ?? {});
    if (!entry.name) {
        return;
    }

    runtimeState.entries.push(entry);

    if (runtimeState.entries.length > MAX_CLIENT_ERROR_BREADCRUMBS) {
        runtimeState.entries.splice(
            0,
            runtimeState.entries.length - MAX_CLIENT_ERROR_BREADCRUMBS,
        );
    }
};

export const readBreadcrumbs = () => {
    return runtimeState.entries.slice(-MAX_CLIENT_ERROR_BREADCRUMBS);
};

export const clearBreadcrumbs = () => {
    runtimeState.entries = [];
};
