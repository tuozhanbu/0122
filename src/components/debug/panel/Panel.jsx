import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from '@/components/common/Toast';
import { useAppDebugSnapshot } from '@/services/appDebug/store';
import AppDebugInfoView from '@/components/debug/panel/InfoView';
import AppDebugStorageView from '@/components/debug/panel/StorageView';
import DebugLogsView from '@/components/debug/logs/LogsView';
import AppDebugToolsView from '@/components/debug/panel/ToolsView';
import { AppDebugToastProvider } from '@/components/debug/panel/ToastContext';

const DEBUG_TAB_INFO = 'info';
const DEBUG_TAB_STORAGE = 'storage';
const DEBUG_TAB_LOGS = 'logs';
const DEBUG_TAB_TOOLS = 'tools';
const DEBUG_TOAST_VISIBLE_MS = 1400;

const headerShadow = {
    boxShadow: '0px 4px 12px rgba(15, 23, 42, 0.08)',
};

function DebugTabButton({ active, icon, label, onPress }) {
    return (
        <TouchableOpacity
            activeOpacity={0.78}
            onPress={onPress}
            style={styles.tabButton}
        >
            <Ionicons
                name={icon}
                size={22}
                color={active ? '#0F766E' : '#64748B'}
            />
            <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
        </TouchableOpacity>
    );
}

export default function AppDebugPanel() {
    const insets = useSafeAreaInsets();
    const appDebug = useAppDebugSnapshot();
    const [activeTab, setActiveTab] = useState(DEBUG_TAB_INFO);
    const toastTimerRef = useRef(null);
    const [toastMessage, setToastMessage] = useState('');
    const visible = appDebug.enabled && appDebug.panelVisible;

    const showToast = useCallback((message) => {
        if (toastTimerRef.current) {
            clearTimeout(toastTimerRef.current);
        }
        setToastMessage(message);
        toastTimerRef.current = setTimeout(() => {
            setToastMessage('');
            toastTimerRef.current = null;
        }, DEBUG_TOAST_VISIBLE_MS);
    }, []);

    useEffect(() => () => {
        if (toastTimerRef.current) {
            clearTimeout(toastTimerRef.current);
        }
    }, []);

    if (!appDebug.allowed) {
        return null;
    }

    return (
        <View
            style={[
                styles.panel,
                !visible && styles.panelHidden,
                { pointerEvents: visible ? 'auto' : 'none' },
            ]}
        >
            {visible && <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />}
            <View style={[styles.headerArea, { paddingTop: insets.top }]}>
                <View style={styles.header}>
                    <Text style={styles.title}>Debug</Text>
                </View>
            </View>
            <View style={styles.body}>
                <AppDebugToastProvider showToast={showToast}>
                    {activeTab === DEBUG_TAB_INFO && (
                        <AppDebugInfoView />
                    )}
                    {activeTab === DEBUG_TAB_STORAGE && (
                        <AppDebugStorageView />
                    )}
                    {activeTab === DEBUG_TAB_TOOLS && (
                        <AppDebugToolsView />
                    )}
                    {activeTab === DEBUG_TAB_LOGS && (
                        <DebugLogsView />
                    )}
                </AppDebugToastProvider>
            </View>
            <View style={[
                styles.tabBar,
                { height: 58 + insets.bottom, paddingBottom: Math.max(insets.bottom, 6) },
            ]}>
                <DebugTabButton
                    active={activeTab === DEBUG_TAB_INFO}
                    icon="information-circle-outline"
                    label="Info"
                    onPress={() => setActiveTab(DEBUG_TAB_INFO)}
                />
                <DebugTabButton
                    active={activeTab === DEBUG_TAB_STORAGE}
                    icon="server-outline"
                    label="Storage"
                    onPress={() => setActiveTab(DEBUG_TAB_STORAGE)}
                />
                <DebugTabButton
                    active={activeTab === DEBUG_TAB_LOGS}
                    icon="document-text-outline"
                    label="Logs"
                    onPress={() => setActiveTab(DEBUG_TAB_LOGS)}
                />
                <DebugTabButton
                    active={activeTab === DEBUG_TAB_TOOLS}
                    icon="construct-outline"
                    label="Tools"
                    onPress={() => setActiveTab(DEBUG_TAB_TOOLS)}
                />
            </View>
            <Toast message={toastMessage} top={insets.top + 64} />
        </View>
    );
}

const styles = StyleSheet.create({
    panel: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        zIndex: 2147483645,
        backgroundColor: '#EEF2F6',
    },
    panelHidden: {
        opacity: 0,
    },
    headerArea: {
        backgroundColor: '#FFFFFF',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#D7DCE3',
        ...headerShadow,
    },
    header: {
        height: 52,
        paddingHorizontal: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
    },
    title: {
        fontSize: 17,
        fontWeight: '700',
        color: '#111827',
    },
    body: {
        flex: 1,
    },
    tabBar: {
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#D7DCE3',
        backgroundColor: '#FFFFFF',
        flexDirection: 'row',
    },
    tabButton: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
    },
    tabLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748B',
    },
    tabLabelActive: {
        color: '#0F766E',
    },
});
