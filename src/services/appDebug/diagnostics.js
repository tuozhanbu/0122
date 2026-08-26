import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { getCalendars, getLocales } from 'expo-localization';
import { Dimensions, Platform } from 'react-native';
import {
    API_BASE_PATH,
    APP_CONFIG,
    APP_NAME,
    APP_VERSION,
    DEV_API_ROOT_URL,
    IsDev,
    PROD_API_ROOT_URLS,
} from '@/constants/config';
import { getActiveBaseURL } from '@/services/domainSelector';
import { redactAppDebugValue } from '@/services/appDebug/redaction';

export function formatAppDebugValue(value) {
    if (value === null || value === undefined || value === '') {
        return '-';
    }
    if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
    }
    if (typeof value === 'object') {
        return JSON.stringify(value, null, 2);
    }
    return String(value);
}

function formatBytes(value) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
        return '-';
    }

    const gb = value / 1024 / 1024 / 1024;
    return `${gb.toFixed(2)} GB`;
}

function readDeviceDiagnostics() {
    const screen = Dimensions.get('screen');
    return {
        brand: Device.brand ?? null,
        model: Device.modelName ?? null,
        realDevice: Device.isDevice,
        yearClass: Device.deviceYearClass ?? null,
        totalMemory: Device.totalMemory ?? null,
        memory: formatBytes(Device.totalMemory),
        os: `${Device.osName ?? ''} ${Device.osVersion ?? ''}`.trim(),
        screen: {
            width: Math.round(screen.width),
            height: Math.round(screen.height),
        },
        locale: getLocales()?.[0]?.languageTag ?? '',
        timezone: getCalendars()?.[0]?.timeZone ?? '',
    };
}

function readApiRoots() {
    if (IsDev) {
        return DEV_API_ROOT_URL ? [DEV_API_ROOT_URL] : [];
    }

    return PROD_API_ROOT_URLS.filter(Boolean);
}

export function buildAppDebugDiagnostics(appDebug, capturedAt = new Date().toISOString()) {
    const device = readDeviceDiagnostics();

    return {
        capturedAt,
        app: {
            name: APP_NAME,
            version: APP_VERSION,
            appId: APP_CONFIG.appId,
            activeApi: getActiveBaseURL(),
            apiRoots: readApiRoots(),
            apiPath: API_BASE_PATH,
            platform: Platform.OS,
        },
        runtime: {
            dev: __DEV__,
            executionEnvironment: Constants.executionEnvironment ?? null,
            expoSdk: Constants.expoConfig?.sdkVersion ?? null,
            slug: Constants.expoConfig?.slug ?? null,
            nativeAppVersion: Constants.nativeAppVersion ?? null,
            nativeBuildVersion: Constants.nativeBuildVersion ?? null,
        },
        device,
        debug: {
            allowed: appDebug.allowed,
            enabled: appDebug.enabled,
            session: appDebug.sessionId,
            installId: appDebug.installId,
            tapArea: appDebug.tapArea,
            webViewDebugPanel: redactAppDebugValue('webViewDebugPanel', appDebug.webViewDebugPanel),
            serverConfig: redactAppDebugValue('debug', appDebug.serverDebugConfig),
        },
        headers: {
            'X-App-Client': appDebug.installId,
            'X-App-Debug': appDebug.enabled ? appDebug.debugRequestHeaders['X-App-Debug'] : '-',
            'X-App-Debug-Session': appDebug.enabled ? appDebug.sessionId : '-',
        },
    };
}

function buildServerDebugRows(serverConfig) {
    if (serverConfig === null) {
        return [{ label: 'Value', value: 'null' }];
    }

    if (serverConfig === undefined) {
        return [{ label: 'Value', value: '-' }];
    }

    if (typeof serverConfig !== 'object' || Array.isArray(serverConfig)) {
        return [{ label: 'Value', value: redactAppDebugValue('Value', serverConfig) }];
    }

    const rows = Object.entries(serverConfig).map(([key, value]) => ({
        label: key,
        value: redactAppDebugValue(key, value),
    }));

    return rows.length > 0 ? rows : [{ label: 'Value', value: '{}' }];
}

export function buildAppDebugDiagnosticsSections(appDebug) {
    const diagnostics = buildAppDebugDiagnostics(appDebug, null);
    const { app, runtime, device, debug, headers } = diagnostics;
    const appRows = [
        { label: 'Name', value: app.name },
        { label: 'Version', value: app.version },
        { label: 'AppId', value: app.appId },
        { label: 'Active API', value: app.activeApi },
        { label: 'API Roots', value: app.apiRoots },
        { label: 'API Path', value: app.apiPath },
        { label: 'Platform', value: app.platform },
    ];

    return [
        {
            title: 'App',
            rows: appRows,
        },
        {
            title: 'Device',
            rows: [
                { label: 'Brand', value: device.brand },
                { label: 'Model', value: device.model },
                { label: 'RealDevice', value: device.realDevice },
                { label: 'YearClass', value: device.yearClass },
                { label: 'Memory', value: device.memory },
                { label: 'OS', value: device.os },
                { label: 'Screen', value: `${device.screen.width} x ${device.screen.height}` },
                { label: 'Locale', value: device.locale },
                { label: 'Timezone', value: device.timezone },
            ],
        },
        {
            title: 'Build / Runtime',
            rows: [
                { label: 'Dev', value: runtime.dev },
                { label: 'ExecutionEnvironment', value: runtime.executionEnvironment },
                { label: 'ExpoSdk', value: runtime.expoSdk },
                { label: 'Slug', value: runtime.slug },
                { label: 'NativeApp', value: runtime.nativeAppVersion },
                { label: 'NativeBuild', value: runtime.nativeBuildVersion },
            ],
        },
        {
            title: 'Debug',
            rows: [
                { label: 'Allowed', value: debug.allowed },
                { label: 'Enabled', value: debug.enabled },
                { label: 'Session', value: debug.session },
                { label: 'InstallId', value: debug.installId },
                { label: 'TapArea', value: debug.tapArea },
                { label: 'WebViewPanel', value: debug.webViewDebugPanel },
            ],
        },
        {
            title: 'Server Debug Config',
            rows: buildServerDebugRows(appDebug.serverDebugConfig),
        },
        {
            title: 'Headers',
            rows: Object.entries(headers).map(([label, value]) => ({ label, value })),
        },
    ];
}
