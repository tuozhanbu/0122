import { systemApi } from '@/services/api/system';
import { parseAttributionClipboardFallback } from '@/services/attribution/clipboardFallback';
import {
    canUseAttributionClipboardFallback,
    normalizeAttributionDeepLinkParams,
    readLatestAttributionDeepLinkParams,
    readStartupAttributionDeepLinkParams,
} from '@/services/attribution/reporter';
import {
    clearOpenUrlClipboardSnapshot,
    getCachedAttributionDeepLinkParams,
    getCachedOpenUrlRuleConfig,
    getJumpFlag,
    readOpenUrlClipboardSnapshot,
    saveOpenUrlClipboardSnapshot,
} from '@/services/openUrlJump';
import { createDebugLogger } from '@/utils/logger';

const logger = createDebugLogger('DeferredJump');

const readOpenUrlVerifyFlag = async () => {
    const jumpFlag = await getJumpFlag();
    return jumpFlag === null ? '' : String(jumpFlag);
};

const readSystemClipboardSnapshot = async () => {
    try {
        const Clipboard = require('expo-clipboard');
        return {
            hasReadClipboard: true,
            clipboardContent: String(await Clipboard.getStringAsync() ?? ''),
        };
    } catch (error) {
        logger.warn('openUrl: startup clipboard read failed', { error });
        return {
            hasReadClipboard: false,
            clipboardContent: '',
        };
    }
};

const resolveClipboardSourcePolicy = ({ base, attributionConfig }) => {
    const ordinaryClipboardEnabled = base.readClipboard === '1';
    return {
        ordinaryClipboardEnabled,
        attributionClipboardFallbackEnabled: !ordinaryClipboardEnabled
            && canUseAttributionClipboardFallback(attributionConfig),
    };
};

/** 没有可用启动深链时，未跳转状态在启动阶段刷新一次剪贴板快照。 */
const captureUnverifiedOpenUrlClipboardSnapshot = async ({ base, attributionConfig }) => {
    const clipboardSourcePolicy = resolveClipboardSourcePolicy({ base, attributionConfig });
    const shouldReadClipboard = clipboardSourcePolicy.ordinaryClipboardEnabled
        || clipboardSourcePolicy.attributionClipboardFallbackEnabled;

    if (!shouldReadClipboard) {
        await clearOpenUrlClipboardSnapshot();
        return clipboardSourcePolicy;
    }

    logger.info('openUrl: startup deep link unavailable, read clipboard fallback', {
        ordinaryClipboardEnabled: clipboardSourcePolicy.ordinaryClipboardEnabled,
        attributionClipboardFallbackEnabled: clipboardSourcePolicy.attributionClipboardFallbackEnabled,
    });
    const clipboardSnapshot = await readSystemClipboardSnapshot();
    await saveOpenUrlClipboardSnapshot(clipboardSnapshot);
    logger.info('openUrl: startup clipboard snapshot refreshed', {
        hasReadClipboard: clipboardSnapshot.hasReadClipboard,
        hasClipboardContent: clipboardSnapshot.clipboardContent.length > 0,
        ordinaryClipboardEnabled: clipboardSourcePolicy.ordinaryClipboardEnabled,
        attributionClipboardFallbackEnabled: clipboardSourcePolicy.attributionClipboardFallbackEnabled,
    });
    logger.info('openUrl: startup clipboard snapshot content', {
        clipboardContent: clipboardSnapshot.clipboardContent,
    });
    return clipboardSourcePolicy;
};

const readSnapshotClipboardContent = async () => {
    const clipboardSnapshot = await readOpenUrlClipboardSnapshot();
    if (!clipboardSnapshot?.hasReadClipboard) {
        return '';
    }

    return clipboardSnapshot.clipboardContent;
};

const readLatestOpenUrlAttributionDeepLinkParams = async () => {
    return normalizeAttributionDeepLinkParams(
        await readLatestAttributionDeepLinkParams(),
    );
};

const readStartupOpenUrlAttributionDeepLinkParams = async () => {
    return normalizeAttributionDeepLinkParams(
        await readStartupAttributionDeepLinkParams(),
    )
        ?? await getCachedAttributionDeepLinkParams();
};

const requestOpenUrl = async ({
    h5Verify,
    clipboardContent,
    source,
    attributionDeepLinkParams = null,
}) => {
    const openUrlRuleConfig = await getCachedOpenUrlRuleConfig();
    logger.info('getOpenUrl: request source', {
        source,
        hasClipboardContent: clipboardContent.length > 0,
    });
    const openUrlRes = await systemApi.getOpenUrl(clipboardContent, h5Verify, openUrlRuleConfig);
    return {
        openUrlRes,
        clipboardContent,
        attributionDeepLinkParams,
    };
};

const requestVerifiedOpenUrl = async (h5Verify) => {
    const attributionDeepLinkParams = await getCachedAttributionDeepLinkParams();
    const attributionDeepLinkValue = String(attributionDeepLinkParams?.linkValue ?? '');
    if (attributionDeepLinkValue) {
        return requestOpenUrl({
            h5Verify,
            clipboardContent: attributionDeepLinkValue,
            source: 'verified_attribution',
            attributionDeepLinkParams,
        });
    }

    return requestOpenUrl({
        h5Verify,
        clipboardContent: await readSnapshotClipboardContent(),
        source: 'verified_snapshot',
    });
};

const captureDeferredOpenUrlState = async ({ base, attributionConfig }) => {
    const attributionDeepLinkParams = await readStartupOpenUrlAttributionDeepLinkParams();
    if (attributionDeepLinkParams) {
        return {
            ...resolveClipboardSourcePolicy({ base, attributionConfig }),
            attributionDeepLinkParams,
        };
    }

    const clipboardSourcePolicy = await captureUnverifiedOpenUrlClipboardSnapshot({
        base,
        attributionConfig,
    });
    return {
        ...clipboardSourcePolicy,
        attributionDeepLinkParams: null,
    };
};

/** 创建静默任务时先采集启动深链；未命中时再采集剪贴板快照。 */
export const createDeferredOpenUrlState = async ({ base, attributionConfig }) => {
    return await captureDeferredOpenUrlState({ base, attributionConfig });
};

/** 刷新静默任务时保留此前已采集、但本次未收到新回调的 AF 归因快照。 */
export const refreshDeferredOpenUrlState = async ({ base, attributionConfig, deferred }) => {
    const attributionDeepLinkParams = (await readStartupOpenUrlAttributionDeepLinkParams())
        ?? deferred.attributionDeepLinkParams;
    if (attributionDeepLinkParams) {
        return {
            ...resolveClipboardSourcePolicy({ base, attributionConfig }),
            attributionDeepLinkParams,
        };
    }

    const clipboardSourcePolicy = await captureUnverifiedOpenUrlClipboardSnapshot({
        base,
        attributionConfig,
    });
    return {
        ...clipboardSourcePolicy,
        attributionDeepLinkParams: null,
    };
};

/** 到点时仅使用已保存的剪贴板快照，不会读取系统剪贴板。 */
export const requestDeferredOpenUrl = async ({ deferred }) => {
    const h5Verify = await readOpenUrlVerifyFlag();

    if (h5Verify === '1') {
        return requestVerifiedOpenUrl(h5Verify);
    }

    const attributionDeepLinkParams = (await readLatestOpenUrlAttributionDeepLinkParams())
        ?? deferred.attributionDeepLinkParams
        ?? await getCachedAttributionDeepLinkParams();
    const attributionDeepLinkValue = String(attributionDeepLinkParams?.linkValue ?? '');
    if (attributionDeepLinkValue) {
        return requestOpenUrl({
            h5Verify,
            clipboardContent: attributionDeepLinkValue,
            source: 'attribution',
            attributionDeepLinkParams,
        });
    }

    const snapshotClipboardContent = await readSnapshotClipboardContent();

    if (deferred.ordinaryClipboardEnabled) {
        return requestOpenUrl({
            h5Verify,
            clipboardContent: snapshotClipboardContent,
            source: 'startup_clipboard',
        });
    }

    const attributionClipboardFallbackParams = deferred.attributionClipboardFallbackEnabled
        ? parseAttributionClipboardFallback(snapshotClipboardContent)
        : null;
    const attributionClipboardFallbackValue = String(attributionClipboardFallbackParams?.linkValue ?? '');
    if (attributionClipboardFallbackValue) {
        return requestOpenUrl({
            h5Verify,
            clipboardContent: attributionClipboardFallbackValue,
            source: 'attribution_clipboard_fallback',
            attributionDeepLinkParams: attributionClipboardFallbackParams,
        });
    }

    return requestOpenUrl({
        h5Verify,
        clipboardContent: '',
        source: 'empty',
    });
};

export const requestBootstrapOpenUrl = async ({ base, attributionConfig }) => {
    const h5Verify = await readOpenUrlVerifyFlag();
    logger.info('getOpenUrl: start', { h5Verify, readClipboard: base.readClipboard });

    if (h5Verify === '1') {
        return requestVerifiedOpenUrl(h5Verify);
    }

    const attributionDeepLinkParams = await readStartupOpenUrlAttributionDeepLinkParams();
    const attributionDeepLinkValue = String(attributionDeepLinkParams?.linkValue ?? '');
    if (attributionDeepLinkValue) {
        return requestOpenUrl({
            h5Verify,
            clipboardContent: attributionDeepLinkValue,
            source: 'attribution',
            attributionDeepLinkParams,
        });
    }

    const clipboardSourcePolicy = await captureUnverifiedOpenUrlClipboardSnapshot({
        base,
        attributionConfig,
    });
    const snapshotClipboardContent = await readSnapshotClipboardContent();

    if (clipboardSourcePolicy.ordinaryClipboardEnabled) {
        return requestOpenUrl({
            h5Verify,
            clipboardContent: snapshotClipboardContent,
            source: 'clipboard',
        });
    }

    const attributionClipboardFallbackParams = clipboardSourcePolicy.attributionClipboardFallbackEnabled
        ? parseAttributionClipboardFallback(snapshotClipboardContent)
        : null;
    const attributionClipboardFallbackValue = String(attributionClipboardFallbackParams?.linkValue ?? '');
    if (attributionClipboardFallbackValue) {
        return requestOpenUrl({
            h5Verify,
            clipboardContent: attributionClipboardFallbackValue,
            source: 'attribution_clipboard_fallback',
            attributionDeepLinkParams: attributionClipboardFallbackParams,
        });
    }

    return requestOpenUrl({
        h5Verify,
        clipboardContent: '',
        source: 'empty',
    });
};
