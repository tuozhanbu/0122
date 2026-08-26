import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Linking,
    Platform,
    StatusBar,
    StyleSheet,
    TouchableOpacity,
    View,
    Text
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import NetworkErrorScreen from '@/components/common/NetworkErrorScreen';
import useWebViewAuthSessionBridge from '@/hooks/useWebViewAuthSessionBridge';
import { createDebugLogger, createLogger } from '@/utils/logger';
import { useAppDebugSnapshot } from '@/services/appDebug/store';
import {
    buildEntryUrl,
    extractEntryConfig,
    resolveChromeStyle,
} from '@/services/webView/entryUrl';
import { buildNativeSafeAreaEvent } from '@/services/webView/injectedScripts/safeArea';
import { handleBridgeMessage } from '@/services/webView/messageActions';
import { openTelegramDestinationOutsideWebView } from '@/services/webView/telegramShareNavigation';
import { buildVpNativeBridge } from '@/services/webView/injectedScripts/vpNativeBridge';
import {
    buildDebugPanelRemoval,
    buildErudaDebugPanel,
    buildVConsoleDebugPanel,
} from '@/services/webView/injectedScripts/debugPanel';
import { WEB_VIEW_PANEL_TYPE_VCONSOLE } from '@/services/appDebug/webViewPanel';

const WEBVIEW_ORIGIN_WHITELIST = ['*'];
const logger = createLogger('WebView');
const debugLogger = createDebugLogger('WebViewDebug');

const RETRYABLE_LOAD_ERROR_CODES = new Set([
    -1009, // iOS: not connected to internet
    -1006, // iOS: DNS lookup failed
    -1005, // iOS: network connection lost
    -1004, // iOS: cannot connect to host
    -1003, // iOS: cannot find host
    -1001, // iOS: timeout
    -8, // Android: timeout
    -7, // Android: IO error
    -6, // Android: connect failed
    -2, // Android: host lookup failed
]);

function isRetryableLoadError(nativeEvent) {
    return RETRYABLE_LOAD_ERROR_CODES.has(Number(nativeEvent?.code));
}

export default function WebViewScreen() {
    // expo-router splits unencoded `&` in the inner URL into top-level route params.
    // e.g. `/webview?url=https://h5.com?XSafeTopStatus=1&XSafeBottomStatus=1`
    // becomes { url: 'https://h5.com?XSafeTopStatus=1', XSafeBottomStatus: '1' }
    // So we must also read X* from the raw route params and merge them in.
    const rawParams = useLocalSearchParams();
    const { url } = rawParams;

    // 从 URL query string 中解析 X* 控制参数，同时得到干净的 URL
    const { cleanUrl, xParams } = useMemo(() => {
        return extractEntryConfig(url, rawParams);
    }, [url, rawParams]);
    const {
        XFullScreen,
        XShowFloatButton,
        XSafeBottom,
        XSafeTop,
        XBackgroundColor,
        XStatusBarStyle,
        XSafeBottomStatus,
        XSafeTopStatus,
    } = xParams;

    // 全屏状态（可动态切换）
    const [fullScreen, setFullScreen] = useState(XFullScreen === '1');

    // WebView 引用 & 内部历史状态
    const webViewRef = useRef(null);
    const initialLoadDoneRef = useRef(false);
    const [canGoBack, setCanGoBack] = useState(false);
    const [showInitOverlay, setShowInitOverlay] = useState(true);
    const [showLoadError, setShowLoadError] = useState(false);
    const [retryingLoad, setRetryingLoad] = useState(false);
    const appDebug = useAppDebugSnapshot();

    const showFloatButton = XShowFloatButton === '1';
    const hasSafeBottom = XSafeBottom === '1';
    const hasSafeTop = XSafeTop === '1';
    const webViewDebug = appDebug.enabled;
    const vpNativeBridgeSource = useMemo(() => (
        buildVpNativeBridge(webViewDebug)
    ), [webViewDebug]);
    const debugPanelType = appDebug.webViewDebugPanel.type;
    const debugPanelScriptUrl = appDebug.webViewDebugPanel.scriptUrl;

    const injectDebugPanel = useCallback(() => {
        if (!debugPanelScriptUrl) {
            debugLogger.warn('debugPanelSkipped', {
                reason: 'invalid_script_url',
            });
            return;
        }

        const debugPanelSource = debugPanelType === WEB_VIEW_PANEL_TYPE_VCONSOLE
            ? buildVConsoleDebugPanel(debugPanelScriptUrl, cleanUrl)
            : buildErudaDebugPanel(debugPanelScriptUrl, cleanUrl);
        webViewRef.current?.injectJavaScript(debugPanelSource);
    }, [cleanUrl, debugPanelScriptUrl, debugPanelType]);

    const removeDebugPanel = useCallback(() => {
        webViewRef.current?.injectJavaScript(buildDebugPanelRemoval());
    }, []);

    // 安全区 insets
    const insets = useSafeAreaInsets();
    const currentSafeTop = Math.round(insets.top);
    const currentSafeBottom = Math.round(insets.bottom);

    const injectNativeSafeArea = useCallback(() => {
        webViewRef.current?.injectJavaScript(buildNativeSafeAreaEvent(currentSafeTop, currentSafeBottom));
    }, [currentSafeTop, currentSafeBottom]);

    const injectVpNativeBridge = useCallback(() => {
        webViewRef.current?.injectJavaScript(vpNativeBridgeSource);
    }, [vpNativeBridgeSource]);

    useEffect(() => {
        if (webViewDebug) {
            injectDebugPanel();
            return;
        }
        removeDebugPanel();
    }, [injectDebugPanel, removeDebugPanel, webViewDebug]);

    // 将 ARGB 16进制（0xAARRGGBB）转为 rgba(r,g,b,a) 字符串，并计算状态栏样式
    const { backgroundColor, barStyle } = useMemo(() => {
        return resolveChromeStyle(XBackgroundColor, XStatusBarStyle);
    }, [XBackgroundColor, XStatusBarStyle]);

    // 切换全屏
    const toggleFullScreen = useCallback(() => {
        setFullScreen((prev) => !prev);
    }, []);

    const postWebViewMessage = useCallback((messageAction, messageParams) => {
        webViewRef.current?.postMessage(JSON.stringify({
            action: messageAction,
            params: messageParams,
        }));
    }, []);

    const {
        runGoogleAuthSession,
        runTelegramAuthSession,
    } = useWebViewAuthSessionBridge({
        postWebViewMessage,
        logger,
    });

    // 处理 H5 通过 ReactNativeWebView 或 vpNativeBridge 发来的消息
    const handleMessage = useCallback(async (event) => {
        try {
            await handleBridgeMessage({
                rawMessage: event.nativeEvent.data,
                openExternalUrl: (targetUrl) => Linking.openURL(targetUrl),
                postWebViewMessage,
                runGoogleAuthSession,
                runTelegramAuthSession,
                injectNativeSafeArea,
                logger,
            });
        } catch (e) {
            logger.warn('message parse failed', { error: e });
        }
    }, [injectNativeSafeArea, postWebViewMessage, runGoogleAuthSession, runTelegramAuthSession]);

    const allowWebViewNavigation = useCallback(({ url: requestedUrl }) => {
        return !openTelegramDestinationOutsideWebView(requestedUrl);
    }, []);

    useEffect(() => {
        if (!initialLoadDoneRef.current) return;
        injectNativeSafeArea();
    }, [injectNativeSafeArea]);

    const entryUrlKey = `${cleanUrl}\n${XSafeTopStatus}\n${XSafeBottomStatus}`;
    const entryUrlRef = useRef({ key: null, url: cleanUrl });
    if (entryUrlRef.current.key !== entryUrlKey) {
        entryUrlRef.current = {
            key: entryUrlKey,
            url: buildEntryUrl(cleanUrl, XSafeTopStatus, XSafeBottomStatus, currentSafeTop, currentSafeBottom),
        };
    }
    const entryUrl = entryUrlRef.current.url;
    const webViewSource = useMemo(() => ({ uri: entryUrl }), [entryUrl]);

    const webview = (
        <WebView
            ref={webViewRef}
            source={webViewSource}
            style={[styles.webview, { backgroundColor }]}
            // 部分 H5 会使用 about:srcdoc、iframe 或跨域资源，放开来源避免被 WebView 当成外部链接拦截。
            originWhitelist={WEBVIEW_ORIGIN_WHITELIST}
            javaScriptEnabled={true}
            // H5 依赖 localStorage/sessionStorage 保存登录态和运行状态。
            domStorageEnabled={true}
            // Android 上允许 iframe 跨域携带 Cookie，避免第三方入口登录态丢失。
            thirdPartyCookiesEnabled={true}
            // 兼容 HTTPS 页面加载 HTTP 资源的场景。
            mixedContentMode="always"
            // iOS 上复用系统 Cookie，减少跨域授权或入口状态不一致。
            sharedCookiesEnabled={true}
            // 不限制 iOS WebView 只能访问 App Bound Domains，避免外部域名被拦截。
            limitsNavigationsToAppBoundDomains={false}
            // 音效、视频动效需要在授权后直接播放。
            mediaPlaybackRequiresUserAction={false}
            allowsInlineMediaPlayback={true}
            onMessage={handleMessage}
            onShouldStartLoadWithRequest={allowWebViewNavigation}
            injectedJavaScriptBeforeContentLoaded={vpNativeBridgeSource}
            webviewDebuggingEnabled={webViewDebug}
            onLoadStart={(event) => {
                debugLogger.info('loadStart', {
                    url: event.nativeEvent?.url,
                });
                if (!initialLoadDoneRef.current) {
                    setShowLoadError(false);
                    setShowInitOverlay(true);
                }
            }}
            onLoadEnd={(event) => {
                debugLogger.info('loadEnd', {
                    url: event.nativeEvent?.url,
                });
                if (webViewDebug) {
                    injectDebugPanel();
                }
                injectVpNativeBridge();
                injectNativeSafeArea();
                if (!initialLoadDoneRef.current) {
                    initialLoadDoneRef.current = true;
                    setShowInitOverlay(false);
                    setRetryingLoad(false);
                }
            }}
            onError={(event) => {
                debugLogger.warn('error', event.nativeEvent);
                if (!initialLoadDoneRef.current) {
                    setShowInitOverlay(false);
                    setShowLoadError(isRetryableLoadError(event.nativeEvent));
                    setRetryingLoad(false);
                }
            }}
            onHttpError={(event) => {
                debugLogger.warn('httpError', event.nativeEvent);
                if (!initialLoadDoneRef.current) {
                    setShowInitOverlay(false);
                    setShowLoadError(false);
                    setRetryingLoad(false);
                }
            }}
            onNavigationStateChange={(navState) => {
                debugLogger.info('navigationStateChange', {
                    url: navState.url,
                    title: navState.title,
                    loading: navState.loading,
                    canGoBack: navState.canGoBack,
                });
                setCanGoBack(navState.canGoBack);
            }}
        />
    );

    // 计算 Header 图标颜色适配背景
    const headerIconColor = barStyle === 'light-content' ? '#ffffff' : '#333333';
    const headerBtnBackgroundColor = barStyle === 'light-content' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)';
    const topBarBackgroundColor = barStyle === 'light-content' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)';

    const handleGoBack = useCallback(() => {
        if (canGoBack) {
            webViewRef.current?.goBack();
        }
        // canGoBack === false 时什么都不做，不允许返回首页
    }, [canGoBack]);

    return (
        <>
            {/* 声明式配置，同步生效，避免首次渲染闪烁首页 title */}
            <Stack.Screen
                options={{
                    headerShown: false,
                    gestureEnabled: false,
                }}
            />

            <View
                style={[
                    styles.container,
                    { backgroundColor },
                    { paddingTop: (fullScreen && hasSafeTop) ? insets.top : 0 },
                    { paddingBottom: hasSafeBottom ? insets.bottom : 0 },
                ]}
            >
                <StatusBar
                    translucent={!hasSafeTop}
                    backgroundColor={backgroundColor}
                    barStyle={barStyle}
                />
                {!fullScreen && (
                    <View
                        style={[
                            styles.topBar,
                            { backgroundColor },
                            { paddingTop: insets.top },
                            { borderBottomColor: topBarBackgroundColor },
                        ]}
                    >
                        <View style={styles.topBarInner}>
                            <TouchableOpacity
                                onPress={handleGoBack}
                                style={[styles.topBarBtn, { backgroundColor: headerBtnBackgroundColor }]}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Ionicons
                                    name={Platform.OS === 'ios' ? 'chevron-back' : 'arrow-back'}
                                    size={16}
                                    color={headerIconColor}
                                />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={toggleFullScreen}
                                style={[styles.topBarBtn, { backgroundColor: headerBtnBackgroundColor }]}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Ionicons name="expand-outline" size={16} color={headerIconColor} />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
                {webview}
                {showInitOverlay && (
                    <View style={[styles.initOverlay, { pointerEvents: 'none' }]}>
                        <ActivityIndicator size="large" color="#FFFFFF" />
                        <Text style={styles.jumpOverlayText}>Loading...</Text>
                    </View>
                )}
                {/* 全屏时显示悬浮退出按钮（受 showFloatButton 控制） */}
                {fullScreen && showFloatButton && (
                    <Animated.View
                        entering={FadeIn.duration(200)}
                        exiting={FadeOut.duration(200)}
                        style={[styles.floatBtn, { top: insets.top + 12 }]}
                    >
                        <TouchableOpacity onPress={toggleFullScreen} style={styles.floatBtnInner}>
                            <Ionicons name="contract-outline" size={20} color="#fff" />
                        </TouchableOpacity>
                    </Animated.View>
                )}
            </View>
            {showLoadError && (
                <NetworkErrorScreen
                    loading={retryingLoad}
                    onPress={() => {
                        initialLoadDoneRef.current = false;
                        setRetryingLoad(true);
                        setShowLoadError(false);
                        setShowInitOverlay(true);
                        webViewRef.current?.reload();
                    }}
                />
            )}
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    webview: {
        flex: 1,
    },
    initOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#1A1D26',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
    },
    jumpOverlayText: {
        marginTop: 12,
        color: '#FFFFFF',
        fontSize: 14,
    },
    topBar: {
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    topBarInner: {
        height: 44,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    topBarBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    floatBtn: {
        position: 'absolute',
        top: 16,
        right: 16,
    },
    floatBtnInner: {
        backgroundColor: 'rgba(0,0,0,0.45)',
        borderRadius: 20,
        padding: 8,
    },
});
