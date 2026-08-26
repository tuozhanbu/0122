import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
    Alert,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import AppDebugToolButton from '@/components/debug/tools/ToolButton';
import { useAppDebugToast } from '@/components/debug/panel/ToastContext';
import { replaceWithBootstrapRestart } from '@/services/bootstrapRestart';
import {
    resetAppDebugFloatingButtonPosition,
    setAppDebugPanelVisible,
    useAppDebugSnapshot,
} from '@/services/appDebug/store';
import { buildAppDebugDiagnostics } from '@/services/appDebug/diagnostics';
import { createLogger } from '@/utils/logger';

const logger = createLogger('AppDebugActions');

const sectionShadow = {
    boxShadow: '0px 4px 12px rgba(15, 23, 42, 0.08)',
};

export default function AppDebugActionSection() {
    const router = useRouter();
    const appDebug = useAppDebugSnapshot();
    const showToast = useAppDebugToast();
    const [copyingSnapshot, setCopyingSnapshot] = useState(false);
    const [resettingButtonPosition, setResettingButtonPosition] = useState(false);
    const busy = copyingSnapshot || resettingButtonPosition;

    const restartBootstrap = () => {
        setAppDebugPanelVisible(false);
        replaceWithBootstrapRestart(router);
    };

    const copyDebugSnapshot = async () => {
        if (busy) return;
        setCopyingSnapshot(true);
        try {
            const payload = buildAppDebugDiagnostics(appDebug);
            await Clipboard.setStringAsync(JSON.stringify(payload, null, 2));
            showToast('Debug snapshot copied.');
        } catch (error) {
            logger.warn('copy debug snapshot failed', { error });
            Alert.alert('Copy Failed', 'Please try again later.');
        } finally {
            setCopyingSnapshot(false);
        }
    };

    const resetButtonPosition = async () => {
        if (busy) return;
        setResettingButtonPosition(true);
        try {
            await resetAppDebugFloatingButtonPosition();
            showToast('Button position reset.');
        } catch (error) {
            logger.warn('reset debug button position failed', { error });
            Alert.alert('Reset Failed', 'Please try again later.');
        } finally {
            setResettingButtonPosition(false);
        }
    };

    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Actions</Text>
            <AppDebugToolButton
                disabled={busy}
                icon="copy-outline"
                loading={copyingSnapshot}
                title="Copy Debug Snapshot"
                detail="Copy redacted diagnostics"
                onPress={copyDebugSnapshot}
            />
            <AppDebugToolButton
                disabled={busy}
                icon="locate-outline"
                loading={resettingButtonPosition}
                title="Reset Button Position"
                detail="Move floating button to default"
                onPress={resetButtonPosition}
            />
            <AppDebugToolButton
                disabled={busy}
                icon="refresh-outline"
                title="Restart Bootstrap"
                detail="Return to the startup chain"
                onPress={restartBootstrap}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    section: {
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
