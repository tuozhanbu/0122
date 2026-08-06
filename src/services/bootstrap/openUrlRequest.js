import { systemApi } from '@/services/api/system';
import { parseAttributionClipboardFallback } from '@/services/attribution/clipboardFallback';
import {
    canUseAttributionClipboardFallback,
    normalizeAttributionDeepLinkParams,
    readCurrentAttributionDeepLinkParams,
    readLatestAttributionDeepLinkParams,
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

/** 未跳转时在启动阶段刷新一次剪贴板快照。 */
const captureUnverifiedOpenUrlClipboardSnapshot = async ({ base, attributionConfig }) => {
    const clipboardSourcePolicy = resolveClipboardSourcePolicy({ base, attributionConfig });
    const shouldReadClipboard = clipboardSourcePolicy.ordinaryClipboardEnabled
        || clipboardSourcePolicy.attributionClipboardFallbackEnabled;

    if (!shouldReadClipboard) {
        await clearOpenUrlClipboardSnapshot();
        return clipboardSourcePolicy;
    }

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

const readCurrentOpenUrlAttributionDeepLinkParams = async () => {
    return normalizeAttributionDeepLinkParams(
        await readCurrentAttributionDeepLinkParams(),
    );
};

const readLatestOpenUrlAttributionDeepLinkParams = async () => {
    return normalizeAttributionDeepLinkParams(
        await readLatestAttributionDeepLinkParams(),
    );
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
    const [clipboardSourcePolicy, attributionDeepLinkParams] = await Promise.all([
        captureUnverifiedOpenUrlClipboardSnapshot({ base, attributionConfig }),
        readCurrentOpenUrlAttributionDeepLinkParams(),
    ]);
    return {
        ...clipboardSourcePolicy,
        attributionDeepLinkParams,
    };
};

/** 创建静默任务时采集剪贴板和当前 AF 归因快照。 */
export const createDeferredOpenUrlState = async ({ base, attributionConfig }) => {
    return await captureDeferredOpenUrlState({ base, attributionConfig });
};

/** 刷新静默任务时保留此前已采集、但本次未收到新回调的 AF 归因快照。 */
export const refreshDeferredOpenUrlState = async ({ base, attributionConfig, deferred }) => {
    const refreshedState = await captureDeferredOpenUrlState({ base, attributionConfig });
    return {
        ...refreshedState,
        attributionDeepLinkParams: refreshedState.attributionDeepLinkParams
            ?? deferred.attributionDeepLinkParams,
    };
};

/** 到点时仅使用已保存的剪贴板快照，不会读取系统剪贴板。 */
export const requestDeferredOpenUrl = async ({ deferred }) => {
    const h5Verify = await readOpenUrlVerifyFlag();

    if (h5Verify === '1') {
        return requestVerifiedOpenUrl(h5Verify);
    }

    const snapshotClipboardContent = await readSnapshotClipboardContent();
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

    const clipboardSourcePolicy = await captureUnverifiedOpenUrlClipboardSnapshot({
        base,
        attributionConfig,
    });
    const snapshotClipboardContent = await readSnapshotClipboardContent();
    const attributionDeepLinkParams = (await readCurrentOpenUrlAttributionDeepLinkParams())
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
