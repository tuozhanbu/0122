import {
    getJumpFlag,
    readDeferredJump,
    saveDeferredJump,
} from '@/services/openUrlJump';
import { recordBreadcrumb } from '@/services/logging/breadcrumbs';
import { createDebugLogger } from '@/utils/logger';
import { getInstallTime } from '@/utils/storage';
import { createInternalEntryAction } from '@/services/bootstrap/actions';
import {
    createDeferredOpenUrlState,
    refreshDeferredOpenUrlState,
    requestBootstrapOpenUrl,
} from '@/services/bootstrap/openUrlRequest';
import { resolveOpenUrlDecision } from '@/services/bootstrap/openUrlDecision';

const logger = createDebugLogger('DeferredJump');

const normalizeOpenUrlVerifyFlag = (jumpFlag) => {
    if (jumpFlag === null) {
        return '';
    }

    return String(jumpFlag);
};

const resolveDeferredJumpAction = async ({ base, attributionConfig }) => {
    const h5Verify = normalizeOpenUrlVerifyFlag(await getJumpFlag());
    if (h5Verify === '1') {
        return null;
    }

    // 已有静默计时任务时，不需要重复请求 getOpenUrl。
    const deferred = await readDeferredJump();
    if (!deferred) {
        return null;
    }

    const deferredState = await refreshDeferredOpenUrlState({
        base,
        attributionConfig,
        deferred,
    });
    await saveDeferredJump({
        triggerAtMs: deferred.triggerAtMs,
        abTest: deferred.abTest,
        ...deferredState,
    });

    logger.info('bootstrap: deferred exists, snapshot refreshed, skip getOpenUrl and go internal', {
        triggerAtMs: deferred.triggerAtMs,
        ordinaryClipboardEnabled: deferredState.ordinaryClipboardEnabled,
        attributionClipboardFallbackEnabled: deferredState.attributionClipboardFallbackEnabled,
        hasAttributionDeepLinkParams: deferredState.attributionDeepLinkParams !== null,
    });
    return createInternalEntryAction({
        abTest: deferred.abTest,
        reason: 'deferred_exists',
    });
};

const resolveOpenUrlAction = async ({ base, attributionConfig }) => {
    logger.info('bootstrap: api.getOpenUrl');
    const openUrlRequest = await requestBootstrapOpenUrl({ base, attributionConfig });
    const openUrlRes = openUrlRequest.openUrlRes;
    logger.info('bootstrap: api.getOpenUrl done', {
        hasData: !!openUrlRes?.data,
        isOpen: openUrlRes?.data?.isOpen,
        linkType: openUrlRes?.data?.linkType,
        hasTargetUrl: !!openUrlRes?.data?.targetUrl,
    });
    recordBreadcrumb({
        category: 'bootstrap',
        name: 'bootstrap.open_url_success',
        data: {
            hasData: !!openUrlRes?.data,
            isOpen: openUrlRes?.data?.isOpen,
            linkType: openUrlRes?.data?.linkType,
            hasTargetUrl: !!openUrlRes?.data?.targetUrl,
        },
    });

    return resolveOpenUrlDecision({
        openUrlRes,
        base,
        clipboardContent: openUrlRequest.clipboardContent,
        attributionDeepLinkParams: openUrlRequest.attributionDeepLinkParams,
    });
};

const resolveNewDeferredJumpAction = async ({ base, attributionConfig }) => {
    if (normalizeOpenUrlVerifyFlag(await getJumpFlag()) === '1') {
        return null;
    }

    const checkTimeSeconds = Number(base.checkTime ?? 0);
    if (!Number.isFinite(checkTimeSeconds) || checkTimeSeconds <= 0) {
        return null;
    }

    const [installTimeSeconds, deferredState] = await Promise.all([
        getInstallTime(),
        createDeferredOpenUrlState({ base, attributionConfig }),
    ]);
    const triggerAtMs = (Math.floor(installTimeSeconds) + Math.floor(checkTimeSeconds)) * 1000;
    await saveDeferredJump({
        triggerAtMs,
        abTest: null,
        ...deferredState,
    });
    logger.info('bootstrap: deferred saved without getOpenUrl', {
        triggerAtMs,
        checkTimeSeconds,
        ordinaryClipboardEnabled: deferredState.ordinaryClipboardEnabled,
        attributionClipboardFallbackEnabled: deferredState.attributionClipboardFallbackEnabled,
        hasAttributionDeepLinkParams: deferredState.attributionDeepLinkParams !== null,
    });
    return createInternalEntryAction({
        abTest: null,
        reason: 'deferred_saved',
    });
};

/**
 * 启动策略只在这里排序：每个客户端策略节点要么返回完整 action，要么返回 null 让下一个节点接管。
 */
export const resolveBootstrapAction = async ({ base, attributionConfig }) => {
    const deferredJumpAction = await resolveDeferredJumpAction({ base, attributionConfig });
    if (deferredJumpAction) {
        return deferredJumpAction;
    }

    const newDeferredJumpAction = await resolveNewDeferredJumpAction({ base, attributionConfig });
    if (newDeferredJumpAction) {
        return newDeferredJumpAction;
    }

    return resolveOpenUrlAction({ base, attributionConfig });
};
