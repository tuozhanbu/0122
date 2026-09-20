import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import useTranslation from '@/hooks/useTranslation';
import ChevronIcon from '@/assets/fruit-quest/common/icons/setting-chevron.svg';

const decodeWebViewUrl = (rawUrl) => {
    const url = String(Array.isArray(rawUrl) ? rawUrl[0] : rawUrl ?? '');
    try {
        return decodeURIComponent(url);
    } catch {
        return url;
    }
};

export default function WebViewScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const { url: rawUrl } = useLocalSearchParams();
    const sourceUrl = useMemo(() => decodeWebViewUrl(rawUrl), [rawUrl]);
    const webViewRef = useRef(null);
    const [canGoBack, setCanGoBack] = useState(false);

    const handleGoBack = useCallback(() => {
        if (canGoBack) {
            webViewRef.current?.goBack();
            return;
        }
        router.back();
    }, [canGoBack, router]);

    return (
        <View style={styles.page}>
            <Stack.Screen options={{ headerShown: false, animation: 'slide_from_right' }} />
            <StatusBar style="light" translucent backgroundColor="transparent" />
            <SafeAreaView style={styles.headerSafeArea} edges={['top', 'left', 'right']}>
                <View style={styles.header}>
                    <Pressable
                        accessibilityLabel={t('返回')}
                        hitSlop={10}
                        onPress={handleGoBack}
                        style={styles.headerSide}
                    >
                        <View style={styles.backIcon}>
                            <ChevronIcon width={20} height={20} />
                        </View>
                    </Pressable>
                    <Text style={styles.title}>{t('隐私政策')}</Text>
                    <View style={styles.headerSide} />
                </View>
            </SafeAreaView>
            {sourceUrl ? (
                <WebView
                    ref={webViewRef}
                    source={{ uri: sourceUrl }}
                    style={styles.webview}
                    onNavigationStateChange={(navState) => {
                        setCanGoBack(Boolean(navState.canGoBack));
                    }}
                />
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    page: {
        flex: 1,
        backgroundColor: '#140628',
    },
    headerSafeArea: {
        backgroundColor: '#181D2E',
    },
    header: {
        height: 56,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
    },
    headerSide: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    backIcon: {
        transform: [{ rotate: '180deg' }],
    },
    title: {
        flex: 1,
        color: '#D1D5DC',
        fontSize: 16,
        fontWeight: '600',
        lineHeight: 22,
        textAlign: 'center',
    },
    webview: {
        flex: 1,
        backgroundColor: '#140628',
    },
});
