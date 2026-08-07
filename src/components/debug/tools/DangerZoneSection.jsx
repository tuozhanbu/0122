import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
    Alert,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import AppDebugCrashTestSection from '@/components/debug/tools/CrashTestSection';
import AppDebugToolButton from '@/components/debug/tools/ToolButton';
import { replaceWithBootstrapRestart } from '@/services/bootstrapRestart';
import {
    setAppDebugEnabled,
    setAppDebugPanelVisible,
    useAppDebugSnapshot,
} from '@/services/appDebug/store';
import {
    clearAllAppData,
    clearAppStorageKeepingDebugSettings,
} from '@/services/appDebug/storage';
import { createLogger } from '@/utils/logger';

const logger = createLogger('AppDebugDangerZone');

const sectionShadow = {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
};

export default function AppDebugDangerZoneSection() {
    const router = useRouter();
    const appDebug = useAppDebugSnapshot();
    const [clearingStorage, setClearingStorage] = useState(false);
    const [clearingAllStorage, setClearingAllStorage] = useState(false);
    const [closingDebug, setClosingDebug] = useState(false);
    const busy = clearingStorage || clearingAllStorage || closingDebug;

    const restartBootstrap = () => {
        setAppDebugPanelVisible(false);
        replaceWithBootstrapRestart(router);
    };

    const clearStorage = async () => {
        if (busy) return;
        setClearingStorage(true);
        try {
            await clearAppStorageKeepingDebugSettings();
            restartBootstrap();
        } catch (error) {
            logger.warn('clear app storage failed', { error });
            Alert.alert('Clear Failed', 'Please try again later.');
        } finally {
            setClearingStorage(false);
        }
    };

    const confirmClearStorage = () => {
        if (busy) return;
        Alert.alert(
            'Clear Local Data?',
            'Debug state and floating button position will be kept.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear',
                    style: 'destructive',
                    onPress: clearStorage,
                },
            ],
        );
    };

    const clearAllStorage = async () => {
        if (busy) return;
        setClearingAllStorage(true);
        try {
            await clearAllAppData();
            restartBootstrap();
        } catch (error) {
            logger.warn('clear all app storage failed', { error });
            Alert.alert('Clear Failed', 'Please try again later.');
        } finally {
            setClearingAllStorage(false);
        }
    };

    const confirmClearAllStorage = () => {
        if (busy) return;
        Alert.alert(
            'Clear All Local Data?',
            'The app will restart bootstrap.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear All',
                    style: 'destructive',
                    onPress: clearAllStorage,
                },
            ],
        );
    };

    const closeDebug = async () => {
        if (busy) return;
        setClosingDebug(true);
        try {
            await setAppDebugEnabled(false);
            replaceWithBootstrapRestart(router);
        } catch (error) {
            logger.warn('close app debug failed', { error });
            Alert.alert('Close Failed', 'Please try again later.');
        } finally {
            setClosingDebug(false);
        }
    };

    const confirmCloseDebug = () => {
        if (busy || !appDebug.enabled) return;
        Alert.alert(
            'Close Debug?',
            'The app will restart bootstrap and stop sending debug headers.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Close',
                    style: 'destructive',
                    onPress: closeDebug,
                },
            ],
        );
    };

    return (
        <>
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Danger Zone</Text>
                <AppDebugToolButton
                    danger
                    disabled={busy}
                    icon="trash-outline"
                    loading={clearingStorage}
                    title="Clear Data"
                    detail="Keep debug state"
                    onPress={confirmClearStorage}
                />
                <AppDebugToolButton
                    danger
                    disabled={busy}
                    icon="warning-outline"
                    loading={clearingAllStorage}
                    title="Clear All Data"
                    detail="Clear local app data"
                    onPress={confirmClearAllStorage}
                />
                <AppDebugToolButton
                    danger
                    disabled={!appDebug.enabled || busy}
                    icon="power-outline"
                    loading={closingDebug}
                    title="Close Debug"
                    detail="Stop sending debug headers"
                    onPress={confirmCloseDebug}
                />
            </View>
            <AppDebugCrashTestSection disabled={busy} />
        </>
    );
}

const styles = StyleSheet.create({
    section: {
        marginTop: 10,
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#CBD3DF',
        backgroundColor: '#FFFFFF',
        overflow: 'hidden',
        ...sectionShadow,
    },
    sectionTitle: {
        minHeight: 38,
        paddingHorizontal: 14,
        paddingTop: 12,
        backgroundColor: '#F8FAFC',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#E2E8F0',
        fontSize: 12,
        fontWeight: '800',
        color: '#4B5563',
        textTransform: 'uppercase',
    },
});
