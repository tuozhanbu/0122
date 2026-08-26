import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    StyleSheet,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from '@/components/common/Toast';
import {
    toggleAppDebugPanelVisible,
    useAppDebugSnapshot,
} from '@/services/appDebug/store';
import { buildDebugTapAreaStyle } from '@/services/appDebug/activationTapArea';
import {
    disableAppDebugAndRestartBootstrap,
    enableAppDebugAndRestartBootstrap,
} from '@/services/appDebug/activation';
import useAppDebugActivationTap from '@/components/debug/overlay/useActivationTap';
import useAppDebugFloatingButtonPosition, {
    APP_DEBUG_FLOATING_BUTTON_SIZE,
} from '@/components/debug/overlay/useFloatingButtonPosition';
import { createLogger } from '@/utils/logger';

const TOAST_VISIBLE_MS = 1400;
const logger = createLogger('AppDebugOverlay');

export default function AppDebugOverlay() {
    const appDebug = useAppDebugSnapshot();

    if (!appDebug.allowed) {
        return null;
    }

    return <AppDebugOverlayLayer appDebug={appDebug} />;
}

function AppDebugOverlayLayer({ appDebug }) {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const windowSize = useWindowDimensions();
    const toastTimerRef = useRef(null);
    const togglingDebugRef = useRef(false);
    const disableConfirmVisibleRef = useRef(false);
    const [toastMessage, setToastMessage] = useState('');

    const tapAreaStyle = useMemo(() => (
        buildDebugTapAreaStyle(appDebug.tapArea, insets.top, insets.bottom)
    ), [appDebug.tapArea, insets.top, insets.bottom]);

    const showToast = useCallback((message) => {
        if (toastTimerRef.current) {
            clearTimeout(toastTimerRef.current);
        }
        setToastMessage(message);
        toastTimerRef.current = setTimeout(() => {
            setToastMessage('');
            toastTimerRef.current = null;
        }, TOAST_VISIBLE_MS);
    }, []);

    const toggleDebugPanel = useCallback(() => {
        toggleAppDebugPanelVisible();
    }, []);

    const enableDebug = useCallback(async () => {
        if (togglingDebugRef.current) {
            return;
        }
        togglingDebugRef.current = true;
        try {
            await enableAppDebugAndRestartBootstrap(router);
            showToast('debug on');
        } catch (error) {
            logger.warn('enable app debug failed', { error });
            showToast('debug failed');
        } finally {
            togglingDebugRef.current = false;
        }
    }, [router, showToast]);

    const disableDebug = useCallback(async () => {
        if (togglingDebugRef.current) {
            return;
        }
        togglingDebugRef.current = true;
        try {
            await disableAppDebugAndRestartBootstrap(router);
            showToast('debug off');
        } catch (error) {
            logger.warn('disable app debug failed', { error });
            showToast('debug failed');
        } finally {
            togglingDebugRef.current = false;
        }
    }, [router, showToast]);

    const requestDisableDebug = useCallback(() => {
        if (togglingDebugRef.current || disableConfirmVisibleRef.current) {
            return;
        }
        disableConfirmVisibleRef.current = true;
        Alert.alert(
            'Close Debug?',
            'The app will restart bootstrap and stop sending debug headers.',
            [
                {
                    text: 'Cancel',
                    style: 'cancel',
                    onPress: () => {
                        disableConfirmVisibleRef.current = false;
                    },
                },
                {
                    text: 'Close',
                    style: 'destructive',
                    onPress: () => {
                        disableConfirmVisibleRef.current = false;
                        disableDebug();
                    },
                },
            ],
            { cancelable: false },
        );
    }, [disableDebug]);

    const activateDebugTap = useCallback(() => {
        if (appDebug.enabled) {
            requestDisableDebug();
            return;
        }
        enableDebug();
    }, [appDebug.enabled, enableDebug, requestDisableDebug]);

    const pressActivationArea = useAppDebugActivationTap(activateDebugTap);
    const {
        buttonPosition,
        panHandlers,
    } = useAppDebugFloatingButtonPosition({
        appDebugEnabled: appDebug.enabled,
        floatingButtonPositionRevision: appDebug.floatingButtonPositionRevision,
        insets,
        windowSize,
        onPress: toggleDebugPanel,
    });

    useEffect(() => () => {
        if (toastTimerRef.current) {
            clearTimeout(toastTimerRef.current);
        }
    }, []);

    return (
        <>
            {!appDebug.panelVisible && (
                <TouchableOpacity
                    accessible={false}
                    activeOpacity={1}
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                    onPress={pressActivationArea}
                    style={[styles.tapArea, tapAreaStyle]}
                />
            )}
            {appDebug.enabled && (
                <View
                    {...panHandlers}
                    style={[styles.floatingButton, buttonPosition]}
                >
                    <Ionicons name="bug-outline" size={20} color="#FFFFFF" />
                </View>
            )}
            <Toast message={toastMessage} top={insets.top + 64} />
        </>
    );
}

const styles = StyleSheet.create({
    tapArea: {
        position: 'absolute',
        zIndex: 2147483646,
    },
    floatingButton: {
        position: 'absolute',
        width: APP_DEBUG_FLOATING_BUTTON_SIZE,
        height: APP_DEBUG_FLOATING_BUTTON_SIZE,
        borderRadius: APP_DEBUG_FLOATING_BUTTON_SIZE / 2,
        backgroundColor: 'rgba(20, 24, 34, 0.88)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2147483647,
        boxShadow: '0px 8px 12px rgba(15, 23, 42, 0.24)',
    },
});
