import { Stack } from 'expo-router';

export default function RootLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                animation: 'none',
            }}
        >
            <Stack.Screen name="index" options={{ headerShown: false, animation: 'none' }} />
        </Stack>
    );
}
