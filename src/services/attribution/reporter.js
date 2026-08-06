import { Linking, Platform } from 'react-native';
import { APP_STORAGE_KEYS } from '@/constants/storageKeys';
import appsFlyerProvider from '@/services/attribution/providers/appsFlyer';
import { normalizeAttributionDeepLinkParams } from '@/services/attribution/deepLinkParams';
import { createDebugLogger } from '@/utils/logger';
import { tryGetItem, trySetItem } from '@/utils/storage';

const attributionLogger = createDebugLogger('Attribution');
const PROVIDERS = {
    appsFlyer: appsFlyerProvider,
};

const createEmptyAttributionConfig = () => ({
    providerName: '',
    provider: null,
    providerConfig: { enabled: false },
    allowDeepLinkOverride: false,
    clipboardFallbackEnabled: false,
});

let attributionId = null;
let attributionSnapshot = null;
let attributionRuntimeConfig = createEmptyAttributionConfig();
let urlOpenListenerRegistered = false;

export { normalizeAttributionDeepLinkParams };

const isObject = (value) => {
    return !!value && typeof value === 'object' && !Array.isArray(value);
};

const readProviderName = (config) => {
    return String(config?.provider ?? '').trim();
};

const readProviderConfig = (config, providerName) => {
    if (!providerName) {
        return { enabled: false };
    }

    return config?.config ?? {};
};

const normalizeAttributionConfig = (config) => {
    if (!isObject(config)) {
        return createEmptyAttributionConfig();
    }

    const providerName = readProviderName(config);
    const provider = PROVIDERS[providerName] ?? null;
    const providerConfig = provider?.normalizeConfig(readProviderConfig(config, providerName)) ?? { enabled: false };

    return {
        providerName,
        provider,
        providerConfig,
        allowDeepLinkOverride: config.allowDeepLinkOverride === true || providerConfig.allowDeepLinkOverride === true,
        clipboardFallbackEnabled: config.clipboardFallbackEnabled === true || providerConfig.clipboardFallbackEnabled === true,
    };
};

const getEmptyAttributionSnapshot = () => ({
    attributionId,
    installConversion: null,
    installConversionFailure: null,
    deepLink: null,
    initialUrl: null,
    latestUrlOpen: null,
    updatedAt: null,
});

const normalizeStoredAttribution = (value) => {
    if (!isObject(value)) {
        return getEmptyAttributionSnapshot();
    }

    return {
        ...getEmptyAttributionSnapshot(),
        ...value,
        attributionId: value.attributionId ?? attributionId,
    };
};

const saveAttributionSnapshot = async (patch) => {
    const storedSnapshot = attributionSnapshot
        ?? normalizeStoredAttribution(await tryGetItem(APP_STORAGE_KEYS.attribution.report));

    const nextSnapshot = {
        ...storedSnapshot,
        ...patch,
        updatedAt: new Date().toISOString(),
    };

    attributionSnapshot = nextSnapshot;
    attributionId = nextSnapshot.attributionId ?? attributionId;
    await trySetItem(APP_STORAGE_KEYS.attribution.report, nextSnapshot);
    return nextSnapshot;
};

const readProviderContext = () => ({
    writeSnapshot: saveAttributionSnapshot,
});

const notifyProviderUrlOpen = (source, url) => {
    attributionRuntimeConfig.provider?.onUrlOpen?.(
        { source, url },
        readProviderContext(),
    );
};

const isAttributionReady = (config = attributionRuntimeConfig) => {
    return !!config.provider && config.provider.isConfigReady(config.providerConfig);
};

export const configureAttributionReporter = (config) => {
    const nextConfig = normalizeAttributionConfig(config);
    const configChanged = JSON.stringify(attributionRuntimeConfig) !== JSON.stringify(nextConfig);

    attributionRuntimeConfig = nextConfig;

    if (configChanged) {
        if (nextConfig.provider?.onConfigUpdated) {
            nextConfig.provider.onConfigUpdated(nextConfig.providerConfig);
        } else {
            attributionLogger.info('config updated', { provider: nextConfig.providerName || 'none' });
        }
    }

    return attributionRuntimeConfig;
};

export const registerAttributionUrlOpenListener = () => {
    if (urlOpenListenerRegistered || Platform.OS === 'web') {
        return;
    }

    urlOpenListenerRegistered = true;

    Linking.getInitialURL()
        .then((url) => {
            const normalizedUrl = String(url ?? '').trim();
            if (!normalizedUrl) {
                return;
            }

            const openedAt = new Date().toISOString();
            saveAttributionSnapshot({
                initialUrl: {
                    url: normalizedUrl,
                    openedAt,
                },
                latestUrlOpen: {
                    source: 'initial',
                    url: normalizedUrl,
                    openedAt,
                },
            }).catch((error) => {
                attributionLogger.warn('initial url save failed', { error });
            });
        })
        .catch((error) => {
            attributionLogger.warn('initial url read failed', { error });
        });

    Linking.addEventListener('url', (event) => {
        const normalizedUrl = String(event?.url ?? '').trim();
        if (!normalizedUrl) {
            return;
        }

        notifyProviderUrlOpen('event', normalizedUrl);
        saveAttributionSnapshot({
            latestUrlOpen: {
                source: 'event',
                url: normalizedUrl,
                openedAt: new Date().toISOString(),
            },
        }).catch((error) => {
            attributionLogger.warn('url open save failed', { error });
        });
    });
};

export const startAttributionReporter = () => {
    if (!isAttributionReady()) {
        return Promise.resolve(null);
    }

    return attributionRuntimeConfig.provider.start(
        attributionRuntimeConfig.providerConfig,
        readProviderContext(),
    );
};

export const beginAttributionOpenUrlDecision = ({ reason, waitForInstallConversion }) => {
    attributionRuntimeConfig.provider?.beginOpenUrlDecision?.({
        reason,
        waitForInstallConversion,
    });
};

export const readAttributionSnapshot = async () => {
    if (attributionSnapshot) {
        return attributionSnapshot;
    }

    attributionSnapshot = normalizeStoredAttribution(
        await tryGetItem(APP_STORAGE_KEYS.attribution.report),
    );
    return attributionSnapshot;
};

export const readCurrentAttributionDeepLinkParams = async () => {
    if (!isAttributionReady() || !attributionRuntimeConfig.provider.canLoad()) {
        return null;
    }

    return await attributionRuntimeConfig.provider.readCurrentDeepLinkParams(
        attributionRuntimeConfig.providerConfig,
        readProviderContext(),
    );
};

/** 延迟 OpenUrl 决策重新读取当前 AF 回调，不复用启动阶段的等待结果。 */
export const readLatestAttributionDeepLinkParams = async () => {
    if (
        !isAttributionReady()
        || !attributionRuntimeConfig.provider.canLoad()
        || typeof attributionRuntimeConfig.provider.readLatestDeepLinkParams !== 'function'
    ) {
        return null;
    }

    return await attributionRuntimeConfig.provider.readLatestDeepLinkParams(
        attributionRuntimeConfig.providerConfig,
        readProviderContext(),
    );
};

export const canOverrideCachedAttributionDeepLinkParams = (config) => {
    return normalizeAttributionConfig(config).allowDeepLinkOverride === true;
};

export const canUseAttributionClipboardFallback = (config) => {
    const normalizedConfig = normalizeAttributionConfig(config);
    return normalizedConfig.providerConfig.enabled === true
        && normalizedConfig.clipboardFallbackEnabled === true;
};

export const parseAttributionClipboardFallbackParams = (payload) => {
    if (!isAttributionReady()) {
        return null;
    }

    return attributionRuntimeConfig.provider.parseClipboardFallback(payload);
};

export const logAttributionEvent = async (eventName, eventValues = {}) => {
    const normalizedEventName = String(eventName ?? '').trim();
    const normalizedEventValues = isObject(eventValues) ? { ...eventValues } : {};

    if (!normalizedEventName) {
        return {
            status: 'failure',
            eventName: normalizedEventName,
            eventValues: {},
            reason: 'empty_event_name',
            loggedAt: new Date().toISOString(),
        };
    }

    if (!isAttributionReady()) {
        return {
            status: 'failure',
            eventName: normalizedEventName,
            eventValues: normalizedEventValues,
            reason: 'invalid_config',
            loggedAt: new Date().toISOString(),
        };
    }

    return await attributionRuntimeConfig.provider.logEvent(
        attributionRuntimeConfig.providerConfig,
        normalizedEventName,
        normalizedEventValues,
        readProviderContext(),
    );
};
