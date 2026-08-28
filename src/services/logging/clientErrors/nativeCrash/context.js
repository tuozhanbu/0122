import { updateNativeCrashContext } from '@/services/logging/clientErrors/nativeCrash/bridge';
import { createLogger } from '@/utils/logger';

const MAX_NATIVE_CRASH_BREADCRUMBS = 12;
const MAX_NATIVE_CRASH_BREADCRUMB_DATA_CHARS = 240;
const BREADCRUMB_SYNC_DELAY_MS = 250;
const logger = createLogger('NativeCrashContext');

const nativeCrashContext = {
    route: '',
    breadcrumbs: [],
};

let contextRevision = 0;
let persistedContextRevision = -1;
let contextSyncTask = null;
let breadcrumbSyncTimer = null;

const buildNativeCrashBreadcrumb = (breadcrumb) => {
    const data = breadcrumb?.data ?? {};
    const serializedData = JSON.stringify(data);

    return {
        time: String(breadcrumb?.time ?? ''),
        category: String(breadcrumb?.category ?? ''),
        name: String(breadcrumb?.name ?? ''),
        level: String(breadcrumb?.level ?? ''),
        data: serializedData.length <= MAX_NATIVE_CRASH_BREADCRUMB_DATA_CHARS
            ? data
            : { truncated: true },
    };
};

const syncNativeCrashContext = () => {
    if (contextSyncTask) {
        return contextSyncTask;
    }

    contextSyncTask = (async () => {
        while (persistedContextRevision !== contextRevision) {
            const revision = contextRevision;
            try {
                await updateNativeCrashContext({
                    route: nativeCrashContext.route,
                    breadcrumbs: nativeCrashContext.breadcrumbs,
                });
            } catch (error) {
                logger.warn('native crash context sync failed', { error });
            }
            persistedContextRevision = revision;
        }
    })()
        .finally(() => {
            contextSyncTask = null;
            if (persistedContextRevision !== contextRevision) {
                syncNativeCrashContext();
            }
        });

    return contextSyncTask;
};

const scheduleBreadcrumbContextSync = () => {
    if (breadcrumbSyncTimer) {
        return;
    }

    breadcrumbSyncTimer = setTimeout(() => {
        breadcrumbSyncTimer = null;
        syncNativeCrashContext();
    }, BREADCRUMB_SYNC_DELAY_MS);
};

export const setNativeCrashRoute = (route) => {
    nativeCrashContext.route = String(route ?? '');
    contextRevision += 1;
    syncNativeCrashContext();
};

export const setNativeCrashBreadcrumbs = (breadcrumbs) => {
    nativeCrashContext.breadcrumbs = Array.isArray(breadcrumbs)
        ? breadcrumbs.slice(-MAX_NATIVE_CRASH_BREADCRUMBS).map(buildNativeCrashBreadcrumb)
        : [];
    contextRevision += 1;
    scheduleBreadcrumbContextSync();
};

export const flushNativeCrashContext = async () => {
    if (breadcrumbSyncTimer) {
        clearTimeout(breadcrumbSyncTimer);
        breadcrumbSyncTimer = null;
    }
    await syncNativeCrashContext();
};

export const clearNativeCrashContext = async () => {
    nativeCrashContext.route = '';
    nativeCrashContext.breadcrumbs = [];
    contextRevision += 1;
    await flushNativeCrashContext();
};
