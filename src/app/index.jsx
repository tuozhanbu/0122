import { useEffect, useRef } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import useLangStore from '@/store/useLangStore';
import {
    DEFAULT_ENTRY_ROUTE,
    BOOTSTRAP_APPEARANCE,
} from '@/constants/appCustomization';

export default function BootstrapScreen() {
    const router = useRouter();
    const initLang = useLangStore((state) => state.initLang);
    const hasEnteredBusinessRef = useRef(false);

    useEffect(() => {
        if (hasEnteredBusinessRef.current) {
            return;
        }

        hasEnteredBusinessRef.current = true;

        const enterBusiness = async () => {
            await initLang();
            router.replace(DEFAULT_ENTRY_ROUTE);
        };

        enterBusiness();
    }, [initLang, router]);

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style={BOOTSTRAP_APPEARANCE.statusBarStyle} />
            <View style={styles.container}>
                <ActivityIndicator size="large" color={BOOTSTRAP_APPEARANCE.indicatorColor} />
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: BOOTSTRAP_APPEARANCE.backgroundColor,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
