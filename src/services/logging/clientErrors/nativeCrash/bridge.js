import { NativeModules } from 'react-native';

const NATIVE_CRASH_REPORTS_MODULE_NAME = 'AppNativeCrashReports';

const getNativeCrashReportsModule = () => {
    const nativeModule = NativeModules[NATIVE_CRASH_REPORTS_MODULE_NAME];
    return nativeModule && typeof nativeModule === 'object' ? nativeModule : null;
};

export const updateNativeCrashContext = async (context) => {
    const nativeModule = getNativeCrashReportsModule();
    if (typeof nativeModule?.setCrashContext !== 'function') {
        return false;
    }

    await nativeModule.setCrashContext(context);
    return true;
};

export const flushNativeCrashReports = async () => {
    const nativeModule = getNativeCrashReportsModule();
    if (typeof nativeModule?.flushPendingNativeCrashReports !== 'function') {
        return { available: false };
    }

    return await nativeModule.flushPendingNativeCrashReports();
};

export const clearNativeCrashReports = async () => {
    const nativeModule = getNativeCrashReportsModule();
    if (typeof nativeModule?.clearPendingNativeCrashReports !== 'function') {
        return { available: false };
    }

    await nativeModule.clearPendingNativeCrashReports();
    return { available: true };
};

export const triggerNativeFatalCrash = async () => {
    const nativeModule = getNativeCrashReportsModule();
    if (typeof nativeModule?.triggerNativeFatalCrash !== 'function') {
        throw new Error('Native crash test module is unavailable. Use an Expo Dev Client or release build.');
    }

    return await nativeModule.triggerNativeFatalCrash();
};

export const triggerNativeObjectiveCException = async () => {
    const nativeModule = getNativeCrashReportsModule();
    if (typeof nativeModule?.triggerNativeObjectiveCException !== 'function') {
        throw new Error('Objective-C exception testing is available only in an iOS Dev Client or release build.');
    }

    return await nativeModule.triggerNativeObjectiveCException();
};

export const triggerNativeCppException = async () => {
    const nativeModule = getNativeCrashReportsModule();
    if (typeof nativeModule?.triggerNativeCppException !== 'function') {
        throw new Error('C++ exception testing is available only in an iOS Dev Client or release build.');
    }

    return await nativeModule.triggerNativeCppException();
};
