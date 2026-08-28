import { Platform } from 'react-native';
import { saveClientErrorReport } from '@/services/logging/clientErrors/files';
import { buildClientErrorReport } from '@/services/logging/clientErrors/reports';
import {
    claimClientErrorReporterInstall,
    setClientErrorCurrentRoute,
} from '@/services/logging/clientErrors/runtime';
import { FATAL_CLIENT_ERROR_CAPTURE_WAIT_MS } from '@/services/logging/clientErrors/constants';
import { recordBreadcrumb } from '@/services/logging/breadcrumbs';
import { setNativeCrashRoute } from '@/services/logging/clientErrors/nativeCrash/context';
import { sanitizeLogValue } from '@/services/logging/redaction/logEntries';
import { createLogger } from '@/utils/logger';

const logger = createLogger('ClientErrorCapture');

export const setClientErrorRoute = (route) => {
    setClientErrorCurrentRoute(route);
    setNativeCrashRoute(route);
    recordBreadcrumb({
        category: 'navigation',
        name: 'route.changed',
        data: { route },
    });
};

export const captureClientException = async (error, context = {}) => {
    try {
        const report = await buildClientErrorReport(error, context);
        return await saveClientErrorReport(report);
    } catch (saveError) {
        logger.warn('capture client exception failed', { error: saveError });
        return null;
    }
};

const waitForFatalCapture = (captureTask) => new Promise((resolve) => {
    let settled = false;
    const finish = () => {
        if (settled) {
            return;
        }
        settled = true;
        resolve();
    };

    const timer = setTimeout(finish, FATAL_CLIENT_ERROR_CAPTURE_WAIT_MS);
    captureTask.finally(() => {
        clearTimeout(timer);
        finish();
    });
});

const installGlobalErrorHandler = () => {
    try {
        const errorUtils = globalThis.ErrorUtils;
        if (!errorUtils?.setGlobalHandler) {
            return;
        }

        const previousHandler = errorUtils.getGlobalHandler?.();
        errorUtils.setGlobalHandler((error, isFatal) => {
            const captureTask = captureClientException(error, {
                source: isFatal ? 'global_fatal' : 'global',
            });

            if (!isFatal) {
                if (typeof previousHandler === 'function') {
                    previousHandler(error, isFatal);
                }
                return;
            }

            waitForFatalCapture(captureTask).finally(() => {
                if (typeof previousHandler === 'function') {
                    previousHandler(error, isFatal);
                }
            });
        });
    } catch (error) {
        logger.warn('install global error handler failed', { error });
    }
};

const installUnhandledRejectionHandler = () => {
    const handleRejection = (event, extra = {}) => {
        const reason = event?.reason ?? event;
        captureClientException(reason instanceof Error ? reason : new Error(String(reason ?? 'Unhandled promise rejection')), {
            source: 'unhandled_rejection',
            extra: {
                reason: sanitizeLogValue(reason),
                ...extra,
            },
        });
    };

    try {
        if (Platform.OS !== 'web') {
            const rejectionTracking = require('promise/setimmediate/rejection-tracking');

            rejectionTracking.enable({
                allRejections: true,
                onUnhandled: (id, rejection) => {
                    handleRejection(rejection, { rejectionId: id });
                },
                onHandled: (id) => {
                    logger.warn('promise rejection handled', { id });
                },
            });
            return;
        }

        const previousHandler = globalThis.onunhandledrejection;
        if (typeof globalThis.addEventListener === 'function') {
            globalThis.addEventListener('unhandledrejection', handleRejection);
        }

        globalThis.onunhandledrejection = (event) => {
            handleRejection(event);
            if (typeof previousHandler === 'function') {
                return previousHandler(event);
            }
            return undefined;
        };
    } catch (error) {
        logger.warn('install unhandled rejection handler failed', { error });
    }
};

export const installClientErrorReporter = () => {
    if (!claimClientErrorReporterInstall()) {
        return;
    }

    installGlobalErrorHandler();
    installUnhandledRejectionHandler();
};
