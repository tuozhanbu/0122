import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { systemApi } from '@/services/api/system';
import {
    executeBootstrapAction,
    replaceInternalEntry,
} from '@/services/bootstrap/navigation';
import { createOpenUrlJumpAction } from '@/services/bootstrap/actions';
import { requestDeferredOpenUrl } from '@/services/bootstrap/openUrlRequest';
import { createDebugLogger } from '@/utils/logger';
import {
    cacheAttributionDeepLinkParamsForJump,
    cacheOpenUrlRuleConfigForJump,
    clearDeferredJump,
    getJumpFlag,
    getDeferredOpenUrlExecutionRevision,
    isSupportedLinkType,
    readDeferredJump,
    setJumpFlag,
} from '@/services/openUrlJump';

const MAX_TIMEOUT_MS = 2147483647;
const deferredJumpLogger = createDebugLogger('DeferredJump');

/**
 * 静默计时到点检测
 *
 * 说明：
 * - 这里不负责“是否开始计时”的决策，启动页只依据 init.checkTime 保存倒计时任务。
 * - 这里仅负责读取 `APP_STORAGE_KEYS.openUrl.deferredJump`，并在到点后复查 getOpenUrl，按最新结果决定是否跳转。
 *   - 到点时会再请求一次 getOpenUrl 获取最新 isOpen/targetUrl/linkType。
 *   - 到点复查只使用启动阶段保存的剪贴板快照，不会再次读取系统剪贴板。
 *   - 只有最新 isOpen === '1' 且 targetUrl/linkType 有效时才跳转。
 *
 * 为什么要有 enabled：
 * - 这个检测不应该在 `/`(启动页) 或 `/webview` 内运行，避免打断启动链路或导致 webview 重载。
 */
export default function useDeferredOpenUrlJump(router, enabled = true) {
    const deferredTimerRef = useRef(null);
    const deferredJumpRunInFlightRef = useRef(false);

    useEffect(() => {
        if (!router || !enabled) {
            return () => { };
        }

        let canceled = false;
        deferredJumpLogger.info('deferred: enabled');
        // 注意：JS timer 在后台可能会被系统挂起，因此同时监听 AppState active 进行复核。

        const clearTimer = () => {
            if (deferredTimerRef.current) {
                clearTimeout(deferredTimerRef.current);
                deferredTimerRef.current = null;
            }
        };

        const executeDeferredJump = async (executionRevision) => {
            const isExecutionCurrent = () => (
                !canceled
                && executionRevision === getDeferredOpenUrlExecutionRevision()
            );

            if (!isExecutionCurrent()) {
                return;
            }

            const jumped = await getJumpFlag();
            if (!isExecutionCurrent()) {
                return;
            }

            if (jumped === '1') {
                await clearDeferredJump();
                if (!isExecutionCurrent()) {
                    return;
                }
                deferredJumpLogger.info('deferred: jumped=1, cleared deferred');
                return;
            }

            const deferred = await readDeferredJump();
            if (!isExecutionCurrent()) {
                return;
            }

            if (!deferred) {
                deferredJumpLogger.info('deferred: none');
                return;
            }

            const { triggerAtMs } = deferred;

            const remaining = triggerAtMs - Date.now();
            deferredJumpLogger.info('deferred: check', {
                nowMs: Date.now(),
                triggerAtMs,
                remainingMs: remaining,
            });

            if (remaining <= 0) {
                deferredJumpLogger.info('deferred: time reached, refresh openUrl');

                let deferredOpenUrlRequest = null;
                try {
                    deferredOpenUrlRequest = await requestDeferredOpenUrl({ deferred });
                } catch (e) {
                    if (!isExecutionCurrent()) {
                        return;
                    }
                    // 保留 deferred，等待下次 AppState active 再尝试
                    deferredJumpLogger.warn('deferred: getOpenUrl refresh failed', { error: e });
                    return;
                }

                if (!isExecutionCurrent()) {
                    return;
                }

                const data = deferredOpenUrlRequest.openUrlRes?.data ?? null;
                const nextTargetUrl = String(data?.targetUrl ?? '');
                const nextLinkType = String(data?.linkType ?? '');
                const nextFingerprint = String(data?.fingerprint ?? '');
                const nextIsOpen = String(data?.isOpen ?? '');
                const nextOpenUrlRuleConfig = data?.clipboardConfig ?? {};

                if (nextIsOpen !== '1' || !nextTargetUrl || !isSupportedLinkType(nextLinkType)) {
                    deferredJumpLogger.info('deferred: refresh returned no jump, cleared deferred', {
                        hasData: !!data,
                        isOpen: nextIsOpen,
                        linkType: nextLinkType,
                        hasTargetUrl: !!nextTargetUrl,
                        abTest: String(data?.abTest ?? ''),
                    });
                    await clearDeferredJump();
                    if (!isExecutionCurrent()) {
                        return;
                    }
                    await replaceInternalEntry(router, data?.abTest);
                    return;
                }

                if (nextFingerprint) {
                    systemApi.fingerprintDelete(nextFingerprint).catch(() => { });
                }

                await setJumpFlag();
                if (!isExecutionCurrent()) {
                    return;
                }
                await cacheOpenUrlRuleConfigForJump({
                    openUrlRuleConfig: nextOpenUrlRuleConfig,
                    isOpen: nextIsOpen,
                    linkType: nextLinkType,
                    targetUrl: nextTargetUrl,
                });
                if (!isExecutionCurrent()) {
                    return;
                }
                await cacheAttributionDeepLinkParamsForJump({
                    attributionDeepLinkParams: deferredOpenUrlRequest.attributionDeepLinkParams,
                    isOpen: nextIsOpen,
                    linkType: nextLinkType,
                    targetUrl: nextTargetUrl,
                });
                if (!isExecutionCurrent()) {
                    return;
                }
                await clearDeferredJump();
                if (!isExecutionCurrent()) {
                    return;
                }
                deferredJumpLogger.info('deferred: refreshed, jump now', { linkType: nextLinkType, targetUrl: nextTargetUrl });
                await executeBootstrapAction(router, createOpenUrlJumpAction({
                    linkType: nextLinkType,
                    targetUrl: nextTargetUrl,
                    abTest: data?.abTest,
                    attributionDeepLinkParams: deferredOpenUrlRequest.attributionDeepLinkParams,
                }));
                return;
            }

            if (!isExecutionCurrent()) {
                return;
            }
            clearTimer();
            const delay = Math.min(remaining, MAX_TIMEOUT_MS);
            deferredJumpLogger.info('deferred: scheduled', { delayMs: delay });
            deferredTimerRef.current = setTimeout(() => {
                if (canceled) {
                    return;
                }
                runDeferredJump().catch((e) => deferredJumpLogger.warn('deferred: trigger failed', { error: e }));
            }, delay);
        };

        const runDeferredJump = async () => {
            if (canceled || deferredJumpRunInFlightRef.current) {
                return;
            }

            deferredJumpRunInFlightRef.current = true;
            try {
                await executeDeferredJump(getDeferredOpenUrlExecutionRevision());
            } finally {
                deferredJumpRunInFlightRef.current = false;
            }
        };

        const appStateListener = AppState.addEventListener('change', (nextState) => {
            if (nextState === 'active') {
                deferredJumpLogger.info('deferred: AppState active, re-check');
                runDeferredJump().catch((e) => deferredJumpLogger.warn('deferred: active check failed', { error: e }));
            }
        });

        runDeferredJump().catch((e) => deferredJumpLogger.warn('deferred: init failed', { error: e }));

        return () => {
            canceled = true;
            clearTimer();
            appStateListener.remove();
            deferredJumpLogger.info('deferred: disabled');
        };
    }, [enabled, router]);
}
