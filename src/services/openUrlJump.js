import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';
import { APP_STORAGE_KEYS } from '@/constants/storageKeys';
import { systemApi } from '@/services/api/system';
import { normalizeAttributionDeepLinkParams } from '@/services/attribution/reporter';
import { createDebugLogger } from '@/utils/logger';

/**
 * OpenUrl 启动策略共享能力（不负责产出最终 action）
 *
 * 设计目标：
 * - 让首次 getOpenUrl 决策与静默到点复查共享同一套 key、配置快照和跳转执行逻辑，避免重复与不一致
 * - 调试日志在 dev 控制台可见，正式包开启本机 Debug 后写入 Debug Logs，tag 统一为 `[DeferredJump]`
 *
 * 约定：
 * - openUrl.jumped: 标记已发生过跳转（避免重复触发）
 * - openUrl.deferredJump: 静默计时任务（JSON）
 *   - triggerAtMs: number 触发时间（毫秒）
 *   - abTest?: '1' | '0'（用于 App 内部落地分流）
 *   - ordinaryClipboardEnabled: boolean
 *   - attributionClipboardFallbackEnabled: boolean
 *   - attributionDeepLinkParams: object | null
 * - openUrl.clipboardSnapshot: 未跳转时每次启动更新、已跳转后复用的剪贴板快照
 * - openUrl.ruleConfigCache: 确定跳转时缓存本次返回的后端跳转规则配置快照
 * - openUrl.attributionDeepLinkParamsCache: 确定跳转时缓存本次命中的归因 deep link 参数
 */
const deferredJumpLogger = createDebugLogger('DeferredJump');
let deferredOpenUrlExecutionRevision = 0;

/** 读取当前静默跳转执行版本，用于识别已被清理操作作废的旧任务。 */
export const getDeferredOpenUrlExecutionRevision = () => deferredOpenUrlExecutionRevision;

/** 使当前进程内已开始的静默跳转任务失效，避免旧请求在清理后继续写入或跳转。 */
export const invalidateDeferredOpenUrlExecutions = () => {
    deferredOpenUrlExecutionRevision += 1;
};

/** 将 linkType 规范化为字符串 */
export const normalizeLinkType = (linkType) => String(linkType ?? '');

/** 判断 linkType 是否为已支持的跳转类型 */
export const isSupportedLinkType = (linkType) => {
    const t = normalizeLinkType(linkType);
    return t === '1' || t === '2';
};

/** 安全 JSON.parse，失败返回 null */
export const safeJsonParse = (raw) => {
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
};

const normalizeOpenUrlClipboardSnapshot = (snapshot) => {
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
        return null;
    }

    const capturedAtMs = Number(snapshot.capturedAtMs);
    if (!Number.isFinite(capturedAtMs) || capturedAtMs <= 0) {
        return null;
    }

    return {
        capturedAtMs,
        hasReadClipboard: snapshot.hasReadClipboard === true,
        clipboardContent: String(snapshot.clipboardContent ?? ''),
    };
};

/** 保存本次启动读取的剪贴板快照；空内容和未读取必须区分。 */
export const saveOpenUrlClipboardSnapshot = async ({ hasReadClipboard, clipboardContent }) => {
    const snapshot = {
        capturedAtMs: Date.now(),
        hasReadClipboard: hasReadClipboard === true,
        clipboardContent: String(clipboardContent ?? ''),
    };
    await AsyncStorage.setItem(
        APP_STORAGE_KEYS.openUrl.clipboardSnapshot,
        JSON.stringify(snapshot),
    ).catch(() => { });
    return snapshot;
};

/** 读取最近一次启动剪贴板快照。 */
export const readOpenUrlClipboardSnapshot = async () => {
    const rawSnapshot = await AsyncStorage.getItem(APP_STORAGE_KEYS.openUrl.clipboardSnapshot).catch(() => null);
    return normalizeOpenUrlClipboardSnapshot(rawSnapshot ? safeJsonParse(rawSnapshot) : null);
};

/** 清理未跳转状态下不再允许使用的启动剪贴板快照。 */
export const clearOpenUrlClipboardSnapshot = async () => {
    await AsyncStorage.removeItem(APP_STORAGE_KEYS.openUrl.clipboardSnapshot).catch(() => { });
};

/** 规范化 getOpenUrl 返回的后端跳转规则配置；空对象表示没有可透传配置。 */
export const normalizeOpenUrlRuleConfig = (openUrlRuleConfig) => {
    if (!openUrlRuleConfig || typeof openUrlRuleConfig !== 'object' || Array.isArray(openUrlRuleConfig)) {
        return {};
    }

    return Object.keys(openUrlRuleConfig).length > 0 ? openUrlRuleConfig : {};
};

/** 判断后端跳转规则配置是否为可缓存、可透传的非空对象。 */
export const hasOpenUrlRuleConfig = (openUrlRuleConfig) => {
    return Object.keys(normalizeOpenUrlRuleConfig(openUrlRuleConfig)).length > 0;
};

/** 读取已跳转标记 */
export const getJumpFlag = async () => {
    return await AsyncStorage.getItem(APP_STORAGE_KEYS.openUrl.jumped).catch(() => null);
};

/** 写入已跳转标记 */
export const setJumpFlag = async () => {
    await AsyncStorage.setItem(APP_STORAGE_KEYS.openUrl.jumped, '1').catch(() => { });
};

/** 清理静默计时任务 */
export const clearDeferredJump = async () => {
    await AsyncStorage.removeItem(APP_STORAGE_KEYS.openUrl.deferredJump).catch(() => { });
};

/** 读取已保存的后端跳转规则配置快照；空对象表示没有可用缓存。 */
export const getCachedOpenUrlRuleConfig = async () => {
    const rawOpenUrlRuleConfig = await AsyncStorage.getItem(APP_STORAGE_KEYS.openUrl.ruleConfigCache).catch(() => null);
    const parsedOpenUrlRuleConfig = rawOpenUrlRuleConfig ? safeJsonParse(rawOpenUrlRuleConfig) : {};
    return normalizeOpenUrlRuleConfig(parsedOpenUrlRuleConfig);
};

/** 读取已保存的归因 deep link 参数；null 表示没有可用缓存 */
export const getCachedAttributionDeepLinkParams = async () => {
    const rawDeepLinkParams = await AsyncStorage.getItem(APP_STORAGE_KEYS.openUrl.attributionDeepLinkParamsCache).catch(() => null);
    const parsedDeepLinkParams = rawDeepLinkParams ? safeJsonParse(rawDeepLinkParams) : null;
    return normalizeAttributionDeepLinkParams(parsedDeepLinkParams);
};

const writeCachedAttributionDeepLinkParams = async (attributionDeepLinkParams) => {
    const nextAttributionDeepLinkParams = normalizeAttributionDeepLinkParams(attributionDeepLinkParams);
    if (!nextAttributionDeepLinkParams) {
        return null;
    }

    await AsyncStorage.setItem(
        APP_STORAGE_KEYS.openUrl.attributionDeepLinkParamsCache,
        JSON.stringify(nextAttributionDeepLinkParams),
    ).catch(() => { });
    return nextAttributionDeepLinkParams;
};

/** 使用本次新归因 deep link 覆盖已保存的参数 */
export const replaceCachedAttributionDeepLinkParams = async (attributionDeepLinkParams) => {
    const nextAttributionDeepLinkParams = normalizeAttributionDeepLinkParams(attributionDeepLinkParams);
    if (!nextAttributionDeepLinkParams) {
        deferredJumpLogger.info('attribution deep link params cache: replace skipped');
        return null;
    }

    await writeCachedAttributionDeepLinkParams(nextAttributionDeepLinkParams);
    deferredJumpLogger.info('attribution deep link params cache: replaced', {
        keys: Object.keys(nextAttributionDeepLinkParams),
    });
    return nextAttributionDeepLinkParams;
};

/** 缓存已确定跳转的后端跳转规则配置快照。 */
export const cacheOpenUrlRuleConfigForJump = async ({ openUrlRuleConfig, isOpen, linkType, targetUrl }) => {
    const nextTargetUrl = String(targetUrl ?? '');
    const nextOpenUrlRuleConfig = normalizeOpenUrlRuleConfig(openUrlRuleConfig);
    const shouldCacheOpenUrlRuleConfig = hasOpenUrlRuleConfig(nextOpenUrlRuleConfig)
        && String(isOpen ?? '') === '1'
        && nextTargetUrl.length > 0
        && isSupportedLinkType(linkType);

    if (shouldCacheOpenUrlRuleConfig) {
        const cachedOpenUrlRuleConfig = await getCachedOpenUrlRuleConfig();
        if (hasOpenUrlRuleConfig(cachedOpenUrlRuleConfig)) {
            deferredJumpLogger.info('openUrl rule config cache: skipped, already cached');
            return;
        }

        await AsyncStorage.setItem(
            APP_STORAGE_KEYS.openUrl.ruleConfigCache,
            JSON.stringify(nextOpenUrlRuleConfig),
        ).catch(() => { });
        deferredJumpLogger.info('openUrl rule config cache: saved', {
            keys: Object.keys(nextOpenUrlRuleConfig),
        });
    }
};

/** 缓存已确定跳转的归因 deep link 参数 */
export const cacheAttributionDeepLinkParamsForJump = async ({ attributionDeepLinkParams, isOpen, linkType, targetUrl }) => {
    const nextAttributionDeepLinkParams = normalizeAttributionDeepLinkParams(attributionDeepLinkParams);
    const nextTargetUrl = String(targetUrl ?? '');
    const shouldCacheAttributionDeepLinkParams = nextAttributionDeepLinkParams !== null
        && String(isOpen ?? '') === '1'
        && nextTargetUrl.length > 0
        && isSupportedLinkType(linkType);

    if (shouldCacheAttributionDeepLinkParams) {
        await writeCachedAttributionDeepLinkParams(nextAttributionDeepLinkParams);
        deferredJumpLogger.info('attribution deep link params cache: saved', {
            keys: Object.keys(nextAttributionDeepLinkParams),
        });
    }
};

/**
 * WebView 跳转前将本次命中的归因 deep link 参数合并进目标 URL。
 * 同名 query 以归因参数为准；无有效参数或 URL 无法解析时返回原始 URL。
 */
export const appendAttributionDeepLinkParamsToWebViewUrl = (targetUrl, attributionDeepLinkParams) => {
    const normalizedDeepLinkParams = normalizeAttributionDeepLinkParams(attributionDeepLinkParams);
    if (!normalizedDeepLinkParams) {
        return targetUrl;
    }

    try {
        const parsedUrl = new URL(targetUrl);
        Object.entries(normalizedDeepLinkParams.urlParams).forEach(([key, value]) => {
            parsedUrl.searchParams.set(key, value);
        });
        return parsedUrl.toString();
    } catch {
        return targetUrl;
    }
};

/** 保存静默计时任务的启动信号快照。 */
export const saveDeferredJump = async ({
    triggerAtMs,
    abTest,
    ordinaryClipboardEnabled,
    attributionClipboardFallbackEnabled,
    attributionDeepLinkParams,
}) => {
    const normalizedAttributionDeepLinkParams = normalizeAttributionDeepLinkParams(attributionDeepLinkParams);
    await AsyncStorage.setItem(APP_STORAGE_KEYS.openUrl.deferredJump, JSON.stringify({
        triggerAtMs,
        abTest: String(abTest ?? '0'),
        ordinaryClipboardEnabled: ordinaryClipboardEnabled === true,
        attributionClipboardFallbackEnabled: attributionClipboardFallbackEnabled === true,
        attributionDeepLinkParams: normalizedAttributionDeepLinkParams,
    })).catch(() => { });
};

/**
 * 读取 deferred jump，若计时数据损坏或无效会清理并返回 null
 */
export const readDeferredJump = async () => {
    const raw = await AsyncStorage.getItem(APP_STORAGE_KEYS.openUrl.deferredJump).catch(() => null);
    if (!raw) return null;

    const parsed = safeJsonParse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        deferredJumpLogger.warn('deferred: invalid payload, cleared');
        await clearDeferredJump();
        return null;
    }

    const triggerAtMs = Number(parsed.triggerAtMs);
    const {
        abTest,
        ordinaryClipboardEnabled,
        attributionClipboardFallbackEnabled,
        attributionDeepLinkParams: rawAttributionDeepLinkParams,
    } = parsed;
    const attributionDeepLinkParams = normalizeAttributionDeepLinkParams(rawAttributionDeepLinkParams);

    if (
        !Number.isFinite(triggerAtMs)
        || triggerAtMs <= 0
        || typeof abTest !== 'string'
        || typeof ordinaryClipboardEnabled !== 'boolean'
        || typeof attributionClipboardFallbackEnabled !== 'boolean'
        || !Object.prototype.hasOwnProperty.call(parsed, 'attributionDeepLinkParams')
        || (rawAttributionDeepLinkParams !== null && attributionDeepLinkParams === null)
    ) {
        deferredJumpLogger.warn('deferred: invalid payload, cleared', {
            triggerAtMs,
        });
        await clearDeferredJump();
        return null;
    }

    return {
        triggerAtMs,
        abTest,
        ordinaryClipboardEnabled,
        attributionClipboardFallbackEnabled,
        attributionDeepLinkParams,
    };
};

/**
 * 按 linkType 执行跳转（会在每次命中跳转时上报 jump）
 * 返回 'webview' | 'external' | null
 */
export const jumpByLinkType = async ({ router, linkType, targetUrl, attributionDeepLinkParams = null }) => {
    const t = normalizeLinkType(linkType);
    if (!isSupportedLinkType(t) || !targetUrl) return null;

    systemApi.sendStat('jump').catch(() => { });

    if (t === '1') {
        const webViewTargetUrl = appendAttributionDeepLinkParamsToWebViewUrl(targetUrl, attributionDeepLinkParams);
        deferredJumpLogger.info('jump: webview', {
            urlLen: webViewTargetUrl?.length ?? 0,
            hasAttributionDeepLinkParams: normalizeAttributionDeepLinkParams(attributionDeepLinkParams) !== null,
        });
        router.replace({
            pathname: '/webview',
            params: { url: encodeURIComponent(webViewTargetUrl) },
        });
        return 'webview';
    }

    if (t === '2') {
        deferredJumpLogger.info('jump: external', { urlLen: targetUrl?.length ?? 0 });
        await Linking.openURL(targetUrl).catch(() => { });
        return 'external';
    }

    return null;
};
