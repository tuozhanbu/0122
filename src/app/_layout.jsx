import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import useLangStore from '@/store/useLangStore';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
    const initLang = useLangStore((state) => state.initLang);

    useEffect(() => {
        let cancelled = false;

        const prepareApp = async () => {
            await initLang();
            if (!cancelled) {
                await SplashScreen.hideAsync();
            }
        };

        prepareApp();

        return () => {
            cancelled = true;
        };
    }, [initLang]);

    return (
        <Stack
            screenOptions={{
                headerShown: false,
                animation: 'none',
            }}
        />
    );
}
