import { NativeModules } from 'react-native';
import { recordBreadcrumb } from '@/services/logging/breadcrumbs';

const MODULE_NAME = 'AppNativeCrashReports';

const getNativeCrashReportsModule = () => {
    const nativeModule = NativeModules[MODULE_NAME];
    return nativeModule && typeof nativeModule === 'object' ? nativeModule : null;
};

export const flushPendingNativeCrashReports = async () => {
    const nativeModule = getNativeCrashReportsModule();
    if (!nativeModule?.flushPendingNativeCrashReports) {
        return { available: false };
    }

    const result = await nativeModule.flushPendingNativeCrashReports();
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
    const nativeModule = getNativeCrashReportsModule();
    if (!nativeModule?.clearPendingNativeCrashReports) {
        return { available: false };
    }

    await nativeModule.clearPendingNativeCrashReports();
    return { available: true };
};

export const triggerNativeCrash = async () => {
    const nativeModule = getNativeCrashReportsModule();
    if (!nativeModule?.triggerNativeCrash) {
        throw new Error('Native crash test module is unavailable. Use an Expo Dev Client or release build.');
    }

    recordBreadcrumb({
        category: 'native',
        name: 'native_crash.test_triggered',
        level: 'warn',
    });
    return await nativeModule.triggerNativeCrash();
};
