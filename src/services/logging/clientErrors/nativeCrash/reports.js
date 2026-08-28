import { recordBreadcrumb } from '@/services/logging/breadcrumbs';
import { flushNativeCrashContext } from '@/services/logging/clientErrors/nativeCrash/context';
import {
    clearNativeCrashReports,
    flushNativeCrashReports,
    triggerNativeCppException,
    triggerNativeFatalCrash,
    triggerNativeObjectiveCException,
} from '@/services/logging/clientErrors/nativeCrash/bridge';

export const flushPendingNativeCrashReports = async () => {
    const result = await flushNativeCrashReports();
    if (result?.available === false) {
        return result;
    }
    const exportedCount = Number(result?.exported ?? 0);
    if (Number.isFinite(exportedCount) && exportedCount > 0) {
        recordBreadcrumb({
            category: 'native',
            name: 'native_crash.flushed',
            data: { exported: exportedCount },
        });
    }
    return result;
};

export const clearPendingNativeCrashReports = async () => {
    return await clearNativeCrashReports();
};

const prepareNativeCrashTest = async (breadcrumbName) => {
    recordBreadcrumb({
        category: 'native',
        name: breadcrumbName,
        level: 'warn',
    });
    await flushNativeCrashContext();
};

export const triggerNativeFatalCrashTest = async () => {
    await prepareNativeCrashTest('native_crash.fatal_test_triggered');
    return await triggerNativeFatalCrash();
};

export const triggerNativeObjectiveCExceptionTest = async () => {
    await prepareNativeCrashTest('native_crash.objective_c_exception_test_triggered');
    return await triggerNativeObjectiveCException();
};

export const triggerNativeCppExceptionTest = async () => {
    await prepareNativeCrashTest('native_crash.cpp_exception_test_triggered');
    return await triggerNativeCppException();
};
