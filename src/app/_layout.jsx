import { Stack, usePathname, useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import ClientErrorBoundary from '@/components/common/ClientErrorBoundary';
import AppDebugOverlay from '@/components/debug/overlay/Overlay';
import AppDebugPanel from '@/components/debug/panel/Panel';
import useBootstrapTranslations from '@/hooks/useBootstrapTranslations';
import useDeferredOpenUrlJump from '@/hooks/useDeferredOpenUrlJump';
import { useAppDebugSnapshot } from '@/services/appDebug/store';
import { installClientErrorReporter, setClientErrorRoute } from '@/services/logging/clientErrors/capture';
import { flushClientErrorReportsWhenDue } from '@/services/logging/clientErrors/uploadSchedule';
import { installDebugLogFileWriter } from '@/services/logging/debugLogs/sessions';
import { recordBreadcrumb } from '@/services/logging/breadcrumbs';
import { createLogger } from '@/utils/logger';

const logger = createLogger('RootLayout');

installDebugLogFileWriter();
installClientErrorReporter();

/**
 * 根布局 - 路由壳 + 策略挂载点（不做首次决策）
 *
 * 分层约定：
 * - 首次决策只在 `src/app/index.jsx`：init + getOpenUrl 产出“立即跳/静默跳/不跳”。
 * - 静默到点检测属于“执行层”，挂在根 layout 里，但用 pathname 做门禁：
 *   - 启动页 `/` 不执行（避免干扰启动链路）
 *   - `/webview` 不执行（避免 webview 被到点逻辑重载/打断）
 */
export default function RootLayout() {
    const router = useRouter();
    const pathname = usePathname();
    const appDebug = useAppDebugSnapshot();
    const enableDeferredCheck = pathname !== '/'
        && !pathname.startsWith('/webview');

    useBootstrapTranslations();
    useDeferredOpenUrlJump(router, enableDeferredCheck);

    useEffect(() => {
        setClientErrorRoute(pathname);
    }, [pathname]);

    useEffect(() => {
        const appStateListener = AppState.addEventListener('change', (nextState) => {
            recordBreadcrumb({
                category: 'app',
                name: 'appstate.changed',
                data: {
                    state: nextState,
                    route: pathname,
                },
            });

            if (nextState !== 'active' || pathname === '/') {
                return;
            }

            flushClientErrorReportsWhenDue().catch((error) => {
                logger.warn('client error foreground flush failed', { error });
            });
        });

        return () => {
            appStateListener.remove();
        };
    }, [pathname]);

    useEffect(() => {
        if (Platform.OS === 'web') return;
        const routeAllowsDeviceOrientation = pathname.startsWith('/webview') && !appDebug.panelVisible;
        const orientationTask = routeAllowsDeviceOrientation
            ? ScreenOrientation.unlockAsync()
            : ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        orientationTask.catch((error) => {
            logger.warn('screen orientation change failed', { pathname, error });
        });
    }, [appDebug.panelVisible, pathname]);

    return (
        <>
            <Stack
                screenOptions={{
                    headerShown: false,
                    animation: 'none',
                }}
            >
                <Stack.Screen name="index" options={{ headerShown: false, animation: 'none' }} />
                <Stack.Screen name="webview" options={{ title: '', headerTitle: () => null, animation: 'none' }} />
            </Stack>
            <ClientErrorBoundary
                fallback={null}
                resetKey={`${appDebug.enabled}:${appDebug.panelVisible}`}
                source="debug_panel_react_boundary"
            >
                <AppDebugPanel />
            </ClientErrorBoundary>
            <ClientErrorBoundary
                fallback={null}
                resetKey={`${appDebug.allowed}:${appDebug.enabled}:${appDebug.panelVisible}:${appDebug.floatingButtonPositionRevision}`}
                source="debug_overlay_react_boundary"
            >
                <AppDebugOverlay />
            </ClientErrorBoundary>
        </>
    );
}
