import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_STORAGE_KEYS } from '@/constants/storageKeys';
import useAppStore from '@/store/useAppStore';
import useLangStore from '@/store/useLangStore';
import useUserStore from '@/store/useUserStore';
import useWebViewAuthStore from '@/store/useWebViewAuthStore';
import {
    clearAppDebugRuntimeInstallId,
    getAppDebugSnapshot,
    readAppDebugFloatingButtonPosition,
    resetAppDebugRuntimeState,
    saveAppDebugFloatingButtonPosition,
    setAppDebugEnabled,
} from '@/services/appDebug/store';
import { clearAttributionRuntimeState } from '@/services/attribution/reporter';
import { clearInstallIdMemoryCache } from '@/services/installIdentity';
import { clearBreadcrumbs } from '@/services/logging/breadcrumbs';
import { clearClientErrorRuntimeContext } from '@/services/logging/clientErrors/runtime';
import { clearNativeCrashContext } from '@/services/logging/clientErrors/nativeCrash/context';
import { waitForActiveClientErrorUpload } from '@/services/logging/clientErrors/uploadSchedule';
import { clearDebugLogFiles } from '@/services/logging/debugLogs/sessions';
import { clearAllLogFiles } from '@/services/logging/jsonlFiles';
import { clearPendingNativeCrashReports } from '@/services/logging/clientErrors/nativeCrash/reports';
import { invalidateDeferredOpenUrlExecutions } from '@/services/openUrlJump';
import { clearAllOrThrow, setItemOrThrow } from '@/utils/storage';

export const readAsyncStorageKeys = async () => {
    const keys = await AsyncStorage.getAllKeys();
    return keys.sort();
};

export const readAsyncStorageValue = (key) => AsyncStorage.getItem(key);

const clearAppRuntimeData = async () => {
    const attributionRuntimeClearTask = clearAttributionRuntimeState();
    invalidateDeferredOpenUrlExecutions();
    clearInstallIdMemoryCache();
    clearAppDebugRuntimeInstallId();
    clearBreadcrumbs();
    clearClientErrorRuntimeContext();
    await clearNativeCrashContext();
    useAppStore.getState().clearBootstrapBase();
    useUserStore.getState().clearUserRuntimeState();
    useLangStore.getState().clearLangRuntimeState();
    useWebViewAuthStore.getState().clearWebViewAuthRuntimeState();
    await attributionRuntimeClearTask;
};

export const clearAppStorageKeepingDebugSettings = async () => {
    const currentSnapshot = getAppDebugSnapshot();
    const debugEnabled = currentSnapshot.enabled;
    const debugSessionId = currentSnapshot.sessionId;
    const buttonPosition = await readAppDebugFloatingButtonPosition();

    await clearAppRuntimeData();
    await clearAllOrThrow();

    const restoreTasks = [
        setItemOrThrow(APP_STORAGE_KEYS.appDebug.enabled, debugEnabled),
    ];

    if (debugEnabled && debugSessionId) {
        restoreTasks.push(setItemOrThrow(APP_STORAGE_KEYS.appDebug.sessionId, debugSessionId));
    }

    if (buttonPosition) {
        restoreTasks.push(saveAppDebugFloatingButtonPosition(buttonPosition));
    }

    await Promise.all(restoreTasks);
};

export const clearAllAppData = async () => {
    await setAppDebugEnabled(false);
    await waitForActiveClientErrorUpload();
    await clearAppRuntimeData();
    await clearAllOrThrow();
    await clearPendingNativeCrashReports();
    await clearDebugLogFiles();
    await clearAllLogFiles();
    resetAppDebugRuntimeState();
};
