import Constants from 'expo-constants';
import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import { normalizeAttributionDeepLinkParams } from '@/services/attribution/deepLinkParams';
import { createDebugLogger } from '@/utils/logger';

const appsFlyerLogger = createDebugLogger('AttributionAppsFlyer');
const DEFAULT_OPEN_URL_DEEP_LINK_WAIT_MS = 5000;
const OPEN_URL_POLL_MS = 250;
const EVENT_LOG_TIMEOUT_MS = 8000;

const APPS_FLYER_DEEP_LINK_PARAM_KEYS = [
    'deep_link_value',
    'deep_link_sub1',
    'deep_link_sub2',
    'deep_link_sub3',
    'deep_link_sub4',
    'deep_link_sub5',
    'deep_link_sub6',
    'deep_link_sub7',
    'deep_link_sub8',
    'deep_link_sub9',
    'deep_link_sub10',
];

let startTask = null;
let listenersRegistered = false;
let latestDeepLink = null;
let latestInstallConversion = null;
let writeSnapshot = () => Promise.resolve(null);
let openUrlDecisionId = 0;
let currentDeepLinkReadTask = null;
let waitForInstallConversion = true;

const wait = (timeoutMs) => new Promise((resolve) => {
    setTimeout(resolve, timeoutMs);
});

const withTimeout = (task, timeoutMs, timeoutReason) => Promise.race([
    task,
    wait(timeoutMs).then(() => {
        throw new Error(timeoutReason);
    }),
]);

const hasConfiguredValue = (value) => {
    const normalizedValue = String(value ?? '').trim();
    return normalizedValue.length > 0;
};

const normalizeEventValues = (eventValues) => {
    if (!eventValues || typeof eventValues !== 'object' || Array.isArray(eventValues)) {
        return {};
    }

    const nextEventValues = { ...eventValues };
    const amount = Number(eventValues.amount);
    const currency = String(eventValues.currency ?? '').trim();

    if (Number.isFinite(amount)) {
        nextEventValues.af_revenue = amount;
    }

    if (currency) {
        nextEventValues.af_currency = currency;
    }

    return nextEventValues;
};

const parseNativeEventPayload = (payload) => {
    if (typeof payload !== 'string') {
        return payload;
    }

    return JSON.parse(payload);
};

const readCallbackFields = (payload) => {
    if (!payload?.data || typeof payload.data !== 'object' || Array.isArray(payload.data)) {
        return null;
    }

    return payload.data;
};

const createCallbackRecord = (payload) => ({
    decisionId: openUrlDecisionId,
    payload,
});

const readCurrentDecisionPayload = (record) => {
    if (!record || record.decisionId !== openUrlDecisionId) {
        return null;
    }

    return record.payload;
};

const readCallbackSummary = (payload) => {
    const callbackFields = readCallbackFields(payload);

    return {
        type: payload?.type,
        status: payload?.status,
        deepLinkStatus: payload?.deepLinkStatus,
        isDeferred: payload?.isDeferred,
        errorDetails: payload?.errorDetails ?? null,
        callbackFieldType: callbackFields ? 'object' : typeof payload?.data,
        callbackFieldKeys: callbackFields ? Object.keys(callbackFields).sort() : [],
        afStatus: callbackFields?.af_status,
        afMessage: callbackFields?.af_message,
        mediaSource: callbackFields?.media_source,
        campaign: callbackFields?.campaign,
        afChannel: callbackFields?.af_channel,
        adset: callbackFields?.af_adset,
        ad: callbackFields?.af_ad,
        installTime: callbackFields?.install_time,
        clickTime: callbackFields?.click_time,
        isFirstLaunch: callbackFields?.is_first_launch,
        deepLinkValue: callbackFields?.deep_link_value,
        deepLinkSub1: callbackFields?.deep_link_sub1,
        link: callbackFields?.link,
    };
};

const isSuccessfulCallback = (payload) => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return false;
    }

    const status = String(payload?.status ?? '').trim().toLowerCase();
    return status === '' || status === 'success';
};

const isFirstLaunch = (conversionData) => {
    const firstLaunch = conversionData?.is_first_launch;
    if (typeof firstLaunch === 'boolean') {
        return firstLaunch;
    }

    return String(firstLaunch ?? '').trim().toLowerCase() === 'true';
};

const isNonOrganicInstall = (conversionData) => {
    return String(conversionData?.af_status ?? '').trim().toLowerCase() === 'non-organic';
};

const mapDeepLinkParams = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }

    const linkValue = String(value.deep_link_value ?? '').trim();
    if (!linkValue) {
        return null;
    }

    const urlParams = {};
    APPS_FLYER_DEEP_LINK_PARAM_KEYS.forEach((key) => {
        const normalizedValue = String(value[key] ?? '').trim();
        if (normalizedValue) {
            urlParams[key] = normalizedValue;
        }
    });

    return normalizeAttributionDeepLinkParams({
        linkValue,
        urlParams,
    });
};

const readDeepLinkParams = (deepLink) => {
    if (!isSuccessfulCallback(deepLink) || deepLink?.deepLinkStatus !== 'FOUND') {
        return null;
    }

    return mapDeepLinkParams(readCallbackFields(deepLink));
};

const readInstallConversionDeepLinkParams = (installConversion) => {
    if (!isSuccessfulCallback(installConversion)) {
        return null;
    }

    const conversionData = readCallbackFields(installConversion);
    if (!isFirstLaunch(conversionData) || !isNonOrganicInstall(conversionData)) {
        return null;
    }

    return mapDeepLinkParams(conversionData);
};

const canLoad = () => {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
        return false;
    }

    if (Constants.appOwnership === 'expo') {
        return false;
    }

    return !!NativeModules.RNAppsFlyer;
};

const readNativeModule = () => {
    if (!canLoad()) {
        appsFlyerLogger.info('native module unavailable, skipped');
        return null;
    }

    return NativeModules.RNAppsFlyer;
};

const isConfigReady = (config) => {
    if (!config?.enabled) {
        appsFlyerLogger.info('disabled by config');
        return false;
    }

    if (!hasConfiguredValue(config.devKey)) {
        appsFlyerLogger.warn('missing devKey, skipped');
        return false;
    }

    if (Platform.OS === 'ios' && !hasConfiguredValue(config.iosAppId)) {
        appsFlyerLogger.warn('missing iosAppId, skipped');
        return false;
    }

    return true;
};

const beginOpenUrlDecision = ({ reason, waitForInstallConversion: shouldWaitForInstallConversion } = {}) => {
    openUrlDecisionId += 1;
    latestDeepLink = null;
    latestInstallConversion = null;
    currentDeepLinkReadTask = null;
    waitForInstallConversion = shouldWaitForInstallConversion !== false;
    appsFlyerLogger.info('openUrl attribution decision started', {
        decisionId: openUrlDecisionId,
        reason: String(reason ?? ''),
    });
    return openUrlDecisionId;
};

const onConfigUpdated = () => {
    if (startTask) {
        appsFlyerLogger.warn('config updated after sdk start; native sdk is not restarted');
        return;
    }

    appsFlyerLogger.info('config updated');
};

const onUrlOpen = ({ source } = {}) => {
    appsFlyerLogger.info('url open observed', {
        source: String(source ?? ''),
        decisionId: openUrlDecisionId,
    });
};

const registerListeners = (nativeModule) => {
    if (listenersRegistered) {
        return;
    }

    const eventEmitter = new NativeEventEmitter(nativeModule);

    eventEmitter.addListener('onInstallConversionDataLoaded', (data) => {
        try {
            const payload = parseNativeEventPayload(data);
            latestInstallConversion = createCallbackRecord(payload);
            appsFlyerLogger.info('install conversion', payload);
            appsFlyerLogger.info('install conversion summary', readCallbackSummary(payload));
            writeSnapshot({
                installConversion: payload,
                installConversionFailure: null,
            }).catch((error) => {
                appsFlyerLogger.warn('install conversion save failed', { error });
            });
        } catch (error) {
            appsFlyerLogger.warn('install conversion parse failed', { error });
        }
    });

    eventEmitter.addListener('onInstallConversionFailure', (data) => {
        try {
            const error = parseNativeEventPayload(data);
            appsFlyerLogger.warn('install conversion failure', { error });
            writeSnapshot({
                installConversionFailure: error,
            }).catch((saveError) => {
                appsFlyerLogger.warn('install conversion failure save failed', { error: saveError });
            });
        } catch (error) {
            appsFlyerLogger.warn('install conversion failure parse failed', { error });
        }
    });

    eventEmitter.addListener('onDeepLinking', (data) => {
        try {
            const payload = parseNativeEventPayload(data);
            latestDeepLink = createCallbackRecord(payload);
            appsFlyerLogger.info('deep link', payload);
            appsFlyerLogger.info('deep link summary', readCallbackSummary(payload));
            writeSnapshot({
                deepLink: payload,
            }).catch((error) => {
                appsFlyerLogger.warn('deep link save failed', { error });
            });
        } catch (error) {
            appsFlyerLogger.warn('deep link parse failed', { error });
        }
    });

    listenersRegistered = true;
};

const readAttributionId = (nativeModule) => {
    return new Promise((resolve) => {
        nativeModule.getAppsFlyerUID((error, uid) => {
            if (error) {
                appsFlyerLogger.warn('uid read failed', { error });
                resolve(null);
                return;
            }

            const attributionId = uid ?? null;
            writeSnapshot({
                attributionId,
            }).catch((saveError) => {
                appsFlyerLogger.warn('uid save failed', { error: saveError });
            });
            appsFlyerLogger.info('uid', { appsFlyerAttributionId: attributionId });
            resolve(attributionId);
        });
    });
};

const start = (config, context) => {
    writeSnapshot = context.writeSnapshot;

    if (startTask) {
        return startTask;
    }

    if (!isConfigReady(config)) {
        return Promise.resolve(null);
    }

    startTask = (async () => {
        const nativeModule = readNativeModule();
        if (!nativeModule) {
            return null;
        }

        registerListeners(nativeModule);

        const initOptions = {
            devKey: config.devKey,
            isDebug: config.debug,
            onInstallConversionDataListener: true,
            onDeepLinkListener: true,
        };

        if (Platform.OS === 'ios') {
            initOptions.appId = config.iosAppId;
        }

        appsFlyerLogger.info('init options', {
            isDebug: initOptions.isDebug,
            appId: initOptions.appId,
            hasDevKey: hasConfiguredValue(initOptions.devKey),
            onInstallConversionDataListener: initOptions.onInstallConversionDataListener,
            onDeepLinkListener: initOptions.onDeepLinkListener,
        });
        await nativeModule.initSdkWithPromise(initOptions);
        appsFlyerLogger.info('initialized');

        return await readAttributionId(nativeModule);
    })().catch((error) => {
        startTask = null;
        appsFlyerLogger.warn('init failed', { error });
        return null;
    });

    return startTask;
};

const waitForCurrentOpenUrlDeepLinkParams = async (config, context) => {
    const openUrlDeepLinkWaitMs = config.openUrlDeepLinkWaitMs;
    if (openUrlDeepLinkWaitMs === 0) {
        appsFlyerLogger.info('openUrl attribution wait skipped by config', {
            decisionId: openUrlDecisionId,
        });
        return null;
    }

    await start(config, context);

    const deadlineAt = Date.now() + openUrlDeepLinkWaitMs;
    appsFlyerLogger.info('openUrl attribution wait start', {
        decisionId: openUrlDecisionId,
        waitMs: openUrlDeepLinkWaitMs,
        hasDeepLinkCallback: readCurrentDecisionPayload(latestDeepLink) !== null,
        hasInstallConversionCallback: readCurrentDecisionPayload(latestInstallConversion) !== null,
    });
    while (Date.now() <= deadlineAt) {
        const deepLink = readCurrentDecisionPayload(latestDeepLink);
        const installConversion = readCurrentDecisionPayload(latestInstallConversion);
        const deepLinkParams = readDeepLinkParams(deepLink);
        if (deepLinkParams) {
            appsFlyerLogger.info('deep link params ready', {
                decisionId: openUrlDecisionId,
                source: 'deep_link',
                keys: Object.keys(deepLinkParams.urlParams),
            });
            return deepLinkParams;
        }

        if (deepLink && !waitForInstallConversion) {
            appsFlyerLogger.info('openUrl deep link unavailable for existing install', {
                decisionId: openUrlDecisionId,
                deepLinkStatus: deepLink?.deepLinkStatus,
                deepLinkSummary: readCallbackSummary(deepLink),
            });
            return null;
        }

        const installConversionDeepLinkParams = readInstallConversionDeepLinkParams(installConversion);
        if (installConversionDeepLinkParams) {
            appsFlyerLogger.info('deep link params ready', {
                decisionId: openUrlDecisionId,
                source: 'install_conversion',
                keys: Object.keys(installConversionDeepLinkParams.urlParams),
            });
            return installConversionDeepLinkParams;
        }

        if (deepLink && installConversion) {
            appsFlyerLogger.warn('openUrl deep link params unavailable', {
                decisionId: openUrlDecisionId,
                deepLinkStatus: deepLink?.deepLinkStatus,
                deepLinkSummary: readCallbackSummary(deepLink),
                installConversionAfStatus: readCallbackFields(installConversion)?.af_status,
                installConversionFirstLaunch: readCallbackFields(installConversion)?.is_first_launch,
                installConversionSummary: readCallbackSummary(installConversion),
            });
            return null;
        }

        await wait(OPEN_URL_POLL_MS);
    }

    const deepLink = readCurrentDecisionPayload(latestDeepLink);
    const installConversion = readCurrentDecisionPayload(latestInstallConversion);
    appsFlyerLogger.warn('openUrl deep link callback unavailable', {
        decisionId: openUrlDecisionId,
        hasDeepLinkCallback: deepLink !== null,
        hasInstallConversionCallback: installConversion !== null,
        deepLinkStatus: deepLink?.deepLinkStatus,
        installConversionAfStatus: readCallbackFields(installConversion)?.af_status,
        installConversionFirstLaunch: readCallbackFields(installConversion)?.is_first_launch,
        deepLinkSummary: deepLink ? readCallbackSummary(deepLink) : null,
        installConversionSummary: installConversion ? readCallbackSummary(installConversion) : null,
    });
    return null;
};

const readCurrentDeepLinkParams = async (config, context) => {
    if (!isConfigReady(config) || !canLoad()) {
        return null;
    }

    if (!currentDeepLinkReadTask) {
        currentDeepLinkReadTask = waitForCurrentOpenUrlDeepLinkParams(config, context);
    }

    return await currentDeepLinkReadTask;
};

const readLatestDeepLinkParams = async (config, context) => {
    if (!isConfigReady(config) || !canLoad()) {
        return null;
    }

    return await waitForCurrentOpenUrlDeepLinkParams(config, context);
};

const logEvent = async (config, eventName, eventValues, context) => {
    if (!isConfigReady(config)) {
        return {
            status: 'failure',
            eventName,
            eventValues,
            reason: 'invalid_config',
            loggedAt: new Date().toISOString(),
        };
    }

    await start(config, context);

    const nativeModule = readNativeModule();
    if (!nativeModule) {
        return {
            status: 'failure',
            eventName,
            eventValues,
            reason: 'native_module_unavailable',
            loggedAt: new Date().toISOString(),
        };
    }

    const providerEventValues = normalizeEventValues(eventValues);

    try {
        const sdkResponse = await withTimeout(
            nativeModule.logEventWithPromise(eventName, providerEventValues),
            EVENT_LOG_TIMEOUT_MS,
            'event_log_timeout',
        );
        appsFlyerLogger.info('event logged', {
            eventName,
            eventValues: providerEventValues,
            sdkResponse,
        });
        return {
            status: 'success',
            eventName,
            eventValues: providerEventValues,
            sdkResponse,
            loggedAt: new Date().toISOString(),
        };
    } catch (error) {
        appsFlyerLogger.warn('event log failed', {
            eventName,
            error,
        });
        return {
            status: 'failure',
            eventName,
            eventValues: providerEventValues,
            reason: error?.message === 'event_log_timeout' ? 'sdk_timeout' : 'sdk_rejected',
            error: error?.message ?? String(error),
            loggedAt: new Date().toISOString(),
        };
    }
};

const normalizeOpenUrlDeepLinkWaitMs = (value) => {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
        return DEFAULT_OPEN_URL_DEEP_LINK_WAIT_MS;
    }

    return value;
};

const normalizeConfig = (config) => ({
    enabled: config?.enabled === true,
    devKey: String(config?.devKey ?? ''),
    iosAppId: String(config?.iosAppId ?? ''),
    debug: config?.debug === true,
    allowDeepLinkOverride: config?.allowDeepLinkOverride === true,
    clipboardFallbackEnabled: config?.clipboardFallbackEnabled === true,
    openUrlDeepLinkWaitMs: normalizeOpenUrlDeepLinkWaitMs(config?.openUrlDeepLinkWaitMs),
});

const parseClipboardFallback = (payload) => {
    return mapDeepLinkParams(payload);
};

const parseUrlDeepLinkParams = (url) => {
    const normalizedUrl = String(url ?? '').trim();
    if (!normalizedUrl) {
        return null;
    }

    try {
        const parsedUrl = new URL(normalizedUrl);
        const urlParams = {};
        parsedUrl.searchParams.forEach((value, key) => {
            urlParams[key] = value;
        });
        return mapDeepLinkParams(urlParams);
    } catch {
        return null;
    }
};

export default {
    name: 'appsFlyer',
    normalizeConfig,
    canLoad,
    isConfigReady,
    onConfigUpdated,
    onUrlOpen,
    beginOpenUrlDecision,
    start,
    readCurrentDeepLinkParams,
    readLatestDeepLinkParams,
    parseUrlDeepLinkParams,
    logEvent,
    parseClipboardFallback,
};
