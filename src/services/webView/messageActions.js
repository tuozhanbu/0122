import {
    ATTRIBUTION_EVENT_RESULT_NAME,
    createAttributionSnapshotResponse,
    readOpenWindowUrl,
    reportAttributionEvent,
} from '@/services/webView/attributionMessages';
import { parseBridgeMessage } from '@/services/webView/bridgeMessage';
import { parseWebViewPresentation } from '@/services/webView/presentationConfig';

export async function handleBridgeMessage({
    rawMessage,
    openExternalUrl,
    postWebViewMessage,
    runGoogleAuthSession,
    runTelegramAuthSession,
    injectNativeSafeArea,
    applyWebViewPresentation,
    logger,
}) {
    const message = parseBridgeMessage(rawMessage);
    if (!message) {
        return;
    }

    const { action, params } = message;

    if (message.eventName) {
        const openWindowUrl = readOpenWindowUrl(message);
        if (openWindowUrl) {
            reportAttributionEvent(message)
                .then((attributionEventReport) => {
                    postWebViewMessage(ATTRIBUTION_EVENT_RESULT_NAME, attributionEventReport ?? null);
                })
                .catch((error) => {
                    logger.warn('attribution event report failed', {
                        eventName: message.eventName,
                        error,
                    });
                });
            openExternalUrl(openWindowUrl).catch(() => { });
            return;
        }

        const attributionEventReport = await reportAttributionEvent(message);
        postWebViewMessage(ATTRIBUTION_EVENT_RESULT_NAME, attributionEventReport ?? null);
        return;
    }

    if (action === 'openBrowser' && params?.url) {
        openExternalUrl(params.url).catch(() => { });
        return;
    }

    if (action === 'openGoogleAuth' && params?.url) {
        runGoogleAuthSession(params.url);
        return;
    }

    if (action === 'openTelegramAuth' && params?.url) {
        runTelegramAuthSession(params.url);
        return;
    }

    if (action === 'applyWebViewPresentation') {
        const webViewPresentation = parseWebViewPresentation(params);
        if (!webViewPresentation) {
            logger.warn('webview presentation rejected', {
                reason: 'invalid_params',
            });
            return;
        }

        try {
            await applyWebViewPresentation(webViewPresentation);
        } catch (error) {
            logger.warn('webview presentation not applied', { error });
        }
        return;
    }

    const attributionSnapshotResponse = await createAttributionSnapshotResponse(action);
    if (attributionSnapshotResponse) {
        postWebViewMessage(attributionSnapshotResponse.eventName, attributionSnapshotResponse.payload);
        return;
    }

    // H5 调用：window.ReactNativeWebView.postMessage(JSON.stringify({ action: 'getSafeArea' }))
    // 响应：window 上触发 CustomEvent('nativeSafeArea')，detail 为 { safeTop, safeBottom }
    if (action === 'getSafeArea') {
        injectNativeSafeArea();
    }
}
