import { useSyncExternalStore } from 'react';
import { APP_STORAGE_KEYS } from '@/constants/storageKeys';
import { readInstallId } from '@/services/installIdentity';
import { recordBreadcrumb } from '@/services/logging/breadcrumbs';
import {
    removeItemOrThrow,
    setItemOrThrow,
    tryGetItem,
} from '@/utils/storage';
import {
    DEFAULT_DEBUG_TAP_AREA,
    safelyParseDebugTapArea,
} from '@/services/appDebug/activationTapArea';
import {
    DEFAULT_WEB_VIEW_PANEL,
    normalizeWebViewPanel,
} from '@/services/appDebug/webViewPanel';

const APP_DEBUG_RUNTIME_STORE_KEY = '__APP_DEBUG_RUNTIME_STORE__';

const createDefaultDebugRequestHeaders = () => ({
    'X-App-Debug': '0',
});

const emptySnapshot = {
    allowed: false,
    enabled: false,
    panelVisible: false,
    floatingButtonPositionRevision: 0,
    sessionId: '',
    installId: '',
    serverDebugConfig: null,
    debugRequestHeaders: createDefaultDebugRequestHeaders(),
    tapArea: DEFAULT_DEBUG_TAP_AREA,
    webViewDebugPanel: DEFAULT_WEB_VIEW_PANEL,
};

const createAppDebugRuntimeStore = () => ({
    snapshot: emptySnapshot,
    listeners: new Set(),
});

const appDebugRuntimeStore = (() => {
    if (!__DEV__) {
        return createAppDebugRuntimeStore();
    }

    if (!globalThis[APP_DEBUG_RUNTIME_STORE_KEY]) {
        globalThis[APP_DEBUG_RUNTIME_STORE_KEY] = createAppDebugRuntimeStore();
    }

    return globalThis[APP_DEBUG_RUNTIME_STORE_KEY];
})();

const listeners = appDebugRuntimeStore.listeners;

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);

const getFloatingButtonPositionRevision = () => (
    isFiniteNumber(getAppDebugSnapshot().floatingButtonPositionRevision)
        ? getAppDebugSnapshot().floatingButtonPositionRevision
        : 0
);

const normalizeFloatingButtonPosition = (position) => {
    if (!position || typeof position !== 'object' || Array.isArray(position)) {
        return null;
    }

    if (!isFiniteNumber(position.left) || !isFiniteNumber(position.top)) {
        return null;
    }

    return {
        left: position.left,
        top: position.top,
    };
};

const emitAppDebugChange = () => {
    listeners.forEach((listener) => listener());
};

const setSnapshot = (nextSnapshot) => {
    appDebugRuntimeStore.snapshot = nextSnapshot;
    emitAppDebugChange();
};

const createAppDebugId = (prefix) => {
    const now = Date.now().toString(36);
    const randomBytes = globalThis.crypto?.getRandomValues
        ? globalThis.crypto.getRandomValues(new Uint8Array(8))
        : null;
    const randomPart = randomBytes
        ? Array.from(randomBytes, (byte) => byte.toString(36).padStart(2, '0')).join('')
        : Math.random().toString(36).slice(2, 14);
    return `${prefix}_${now}_${randomPart}`;
};

const createAppDebugSessionId = () => {
    return createAppDebugId('dbg');
};

const readStoredAppDebugState = async () => {
    const [enabled, sessionId, installId] = await Promise.all([
        tryGetItem(APP_STORAGE_KEYS.appDebug.enabled),
        tryGetItem(APP_STORAGE_KEYS.appDebug.sessionId),
        readInstallId(),
    ]);

    return {
        enabled: enabled === true,
        sessionId: typeof sessionId === 'string' ? sessionId : '',
        installId,
    };
};

const normalizeDebugTapArea = (tapArea) => {
    if (!tapArea || typeof tapArea !== 'object' || Array.isArray(tapArea)) {
        return DEFAULT_DEBUG_TAP_AREA;
    }
    return safelyParseDebugTapArea(tapArea);
};

const normalizeDebugRequestHeaders = (requestHeaders) => {
    const normalizedHeaders = createDefaultDebugRequestHeaders();

    if (!requestHeaders || typeof requestHeaders !== 'object' || Array.isArray(requestHeaders)) {
        return normalizedHeaders;
    }

    Object.entries(requestHeaders).forEach(([name, value]) => {
        const headerName = name.trim();
        const normalizedHeaderName = headerName.toLowerCase();

        if (!headerName || normalizedHeaderName === 'x-app-debug-session') {
            return;
        }

        if (typeof value !== 'string' && typeof value !== 'number') {
            return;
        }

        if (normalizedHeaderName === 'x-app-debug') {
            normalizedHeaders['X-App-Debug'] = String(value);
            return;
        }

        normalizedHeaders[headerName] = String(value);
    });

    return normalizedHeaders;
};

const normalizeDebugConfig = (debugConfig) => {
    if (!debugConfig || typeof debugConfig !== 'object' || Array.isArray(debugConfig)) {
        return {
            serverDebugConfig: debugConfig ?? null,
            debugRequestHeaders: createDefaultDebugRequestHeaders(),
            tapArea: DEFAULT_DEBUG_TAP_AREA,
            webViewDebugPanel: DEFAULT_WEB_VIEW_PANEL,
        };
    }

    return {
        serverDebugConfig: debugConfig,
        debugRequestHeaders: normalizeDebugRequestHeaders(debugConfig.requestHeaders),
        tapArea: normalizeDebugTapArea(debugConfig.tapArea),
        webViewDebugPanel: normalizeWebViewPanel(debugConfig.webViewDebugPanel),
    };
};

export const getAppDebugSnapshot = () => appDebugRuntimeStore.snapshot;

export const subscribeAppDebug = (listener) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};

export const useAppDebugSnapshot = () => {
    return useSyncExternalStore(subscribeAppDebug, getAppDebugSnapshot, getAppDebugSnapshot);
};

export const loadStoredAppDebugState = async () => {
    const storedState = await readStoredAppDebugState();
    setSnapshot({
        ...getAppDebugSnapshot(),
        enabled: storedState.enabled,
        sessionId: storedState.sessionId,
        installId: storedState.installId,
    });
    return storedState;
};

export const configureAppDebugFromInit = async (initData, storedState) => {
    const hasDebugConfig = initData && typeof initData === 'object' && hasOwn(initData, 'debug');

    if (!hasDebugConfig) {
        await Promise.all([
            setItemOrThrow(APP_STORAGE_KEYS.appDebug.enabled, false),
            removeItemOrThrow(APP_STORAGE_KEYS.appDebug.sessionId),
        ]);
        setSnapshot(emptySnapshot);
        return;
    }

    const debugConfig = normalizeDebugConfig(initData.debug);
    const currentSnapshot = getAppDebugSnapshot();

    setSnapshot({
        allowed: true,
        enabled: storedState.enabled,
        panelVisible: currentSnapshot.panelVisible && storedState.enabled,
        floatingButtonPositionRevision: getFloatingButtonPositionRevision(),
        sessionId: storedState.sessionId,
        installId: storedState.installId,
        serverDebugConfig: debugConfig.serverDebugConfig,
        debugRequestHeaders: debugConfig.debugRequestHeaders,
        tapArea: debugConfig.tapArea,
        webViewDebugPanel: debugConfig.webViewDebugPanel,
    });
    recordBreadcrumb({
        category: 'debug',
        name: 'debug.allowed',
        data: {
            enabled: storedState.enabled,
            hasServerConfig: debugConfig.serverDebugConfig !== null,
        },
    });
};

export const setAppDebugEnabled = async (enabled) => {
    const currentSnapshot = getAppDebugSnapshot();

    if (!currentSnapshot.allowed && enabled) {
        return currentSnapshot;
    }

    if (!enabled) {
        await Promise.all([
            setItemOrThrow(APP_STORAGE_KEYS.appDebug.enabled, false),
            removeItemOrThrow(APP_STORAGE_KEYS.appDebug.sessionId),
        ]);
        const nextSnapshot = {
            ...currentSnapshot,
            enabled: false,
            panelVisible: false,
            sessionId: '',
        };
        setSnapshot(nextSnapshot);
        recordBreadcrumb({
            category: 'debug',
            name: 'debug.disabled',
        });
        return nextSnapshot;
    }

    if (currentSnapshot.enabled) {
        return currentSnapshot;
    }

    const sessionId = createAppDebugSessionId();
    await Promise.all([
        setItemOrThrow(APP_STORAGE_KEYS.appDebug.enabled, true),
        setItemOrThrow(APP_STORAGE_KEYS.appDebug.sessionId, sessionId),
    ]);
    const nextSnapshot = {
        ...currentSnapshot,
        enabled: true,
        sessionId,
    };
    setSnapshot(nextSnapshot);
    recordBreadcrumb({
        category: 'debug',
        name: 'debug.enabled',
        data: { sessionId },
    });
    return nextSnapshot;
};

export const setAppDebugPanelVisible = (visible) => {
    const currentSnapshot = getAppDebugSnapshot();
    const panelVisible = Boolean(visible && currentSnapshot.allowed && currentSnapshot.enabled);
    const nextSnapshot = {
        ...currentSnapshot,
        panelVisible,
    };
    setSnapshot(nextSnapshot);
    return nextSnapshot;
};

export const resetAppDebugRuntimeState = () => {
    setSnapshot(emptySnapshot);
};

export const clearAppDebugRuntimeInstallId = () => {
    setSnapshot({
        ...getAppDebugSnapshot(),
        installId: '',
    });
};

export const toggleAppDebugPanelVisible = () => {
    return setAppDebugPanelVisible(!getAppDebugSnapshot().panelVisible);
};

export const readAppDebugFloatingButtonPosition = async () => {
    const position = await tryGetItem(APP_STORAGE_KEYS.appDebug.floatingButtonPosition);
    return normalizeFloatingButtonPosition(position);
};

export const saveAppDebugFloatingButtonPosition = async (position) => {
    const nextPosition = normalizeFloatingButtonPosition(position);
    if (!nextPosition) {
        return;
    }

    await setItemOrThrow(APP_STORAGE_KEYS.appDebug.floatingButtonPosition, nextPosition);
};

export const resetAppDebugFloatingButtonPosition = async () => {
    await removeItemOrThrow(APP_STORAGE_KEYS.appDebug.floatingButtonPosition);
    const nextSnapshot = {
        ...getAppDebugSnapshot(),
        floatingButtonPositionRevision: getFloatingButtonPositionRevision() + 1,
    };
    setSnapshot(nextSnapshot);
    return nextSnapshot;
};
