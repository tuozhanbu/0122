import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { LogActionButton } from '@/components/debug/logs/LogControls';
import {
    deleteDebugLogSession,
    readDebugLogEntries,
    readDebugLogText,
} from '@/services/logging/debugLogs/sessions';
import { createLogger } from '@/utils/logger';
import { formatDebugLogEntry } from '@/components/debug/logs/formatEntries';
import { useAppDebugToast } from '@/components/debug/panel/ToastContext';

const logger = createLogger('DebugLogSessionDetailView');

const surfaceShadow = {
    boxShadow: '0px 4px 12px rgba(15, 23, 42, 0.08)',
};

export default function DebugLogSessionDetailView({ sessionId, onBack, onDeleted }) {
    const showToast = useAppDebugToast();
    const [loading, setLoading] = useState(false);
    const [entries, setEntries] = useState([]);

    const loadEntries = useCallback(async () => {
        setLoading(true);
        try {
            setEntries(await readDebugLogEntries(sessionId, 200));
        } catch (error) {
            logger.warn('load debug log detail failed', { error });
            Alert.alert('Load Failed', 'Please try again later.');
        } finally {
            setLoading(false);
        }
    }, [sessionId]);

    useEffect(() => {
        loadEntries();
    }, [loadEntries]);

    const copyCurrentLog = async () => {
        if (loading) return;
        setLoading(true);
        try {
            await Clipboard.setStringAsync(await readDebugLogText(sessionId));
            showToast('Logs copied.');
        } catch (error) {
            logger.warn('copy debug log failed', { error });
            Alert.alert('Copy Failed', 'Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    const deleteSession = async () => {
        if (loading) return;
        setLoading(true);
        let deleted = false;
        try {
            await deleteDebugLogSession(sessionId);
            deleted = true;
        } catch (error) {
            logger.warn('delete debug log failed', { error });
            Alert.alert('Delete Failed', 'Please try again later.');
        } finally {
            setLoading(false);
        }
        if (deleted) {
            onDeleted();
        }
    };

    const confirmDeleteSession = () => {
        if (loading) return;
        Alert.alert(
            'Delete Log?',
            'This action cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: deleteSession },
            ],
        );
    };

    return (
        <View style={styles.page}>
            <View style={styles.detailHeader}>
                <TouchableOpacity activeOpacity={0.78} onPress={onBack} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={18} color="#0F766E" />
                    <Text style={styles.backButtonText}>Launches</Text>
                </TouchableOpacity>
                <Text style={styles.detailTitle} numberOfLines={1}>{sessionId}</Text>
            </View>

            <View style={styles.actions}>
                <LogActionButton disabled={loading} icon="refresh-outline" title="Refresh" onPress={loadEntries} />
                <LogActionButton disabled={loading} icon="copy-outline" title="Copy" onPress={copyCurrentLog} />
                <LogActionButton danger disabled={loading} icon="trash-outline" title="Delete" onPress={confirmDeleteSession} />
            </View>

            <View style={styles.logCard}>
                <View style={styles.logHeader}>
                    <Text style={styles.logTitle}>Debug Log</Text>
                    <Text style={styles.logCount}>{entries.length}</Text>
                </View>
                <ScrollView style={styles.logScroll} contentContainerStyle={styles.logScrollContent}>
                    {entries.length === 0 ? (
                        <Text style={styles.emptyText}>{loading ? 'Loading...' : 'No logs'}</Text>
                    ) : entries.map((entry, index) => (
                        <View key={`${entry.time ?? index}-${index}`} style={styles.logRow}>
                            <Text style={styles.logText} selectable>{formatDebugLogEntry(entry)}</Text>
                        </View>
                    ))}
                </ScrollView>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    page: {
        flex: 1,
    },
    detailHeader: {
        minHeight: 44,
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#CBD3DF',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 10,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        ...surfaceShadow,
    },
    backButton: {
        minHeight: 34,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    backButtonText: {
        fontSize: 13,
        fontWeight: '800',
        color: '#0F766E',
    },
    detailTitle: {
        flex: 1,
        fontSize: 12,
        color: '#64748B',
        textAlign: 'right',
    },
    actions: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 10,
    },
    logCard: {
        flex: 1,
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#CBD3DF',
        backgroundColor: '#FFFFFF',
        overflow: 'hidden',
        ...surfaceShadow,
    },
    logHeader: {
        minHeight: 38,
        paddingHorizontal: 14,
        backgroundColor: '#F8FAFC',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#E2E8F0',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    logTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: '#4B5563',
        textTransform: 'uppercase',
    },
    logCount: {
        fontSize: 12,
        fontWeight: '800',
        color: '#64748B',
    },
    logScroll: {
        flex: 1,
    },
    logScrollContent: {
        paddingBottom: 10,
    },
    emptyText: {
        paddingHorizontal: 14,
        paddingVertical: 18,
        fontSize: 13,
        color: '#64748B',
    },
    logRow: {
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#E2E6EC',
    },
    logText: {
        fontSize: 11,
        lineHeight: 16,
        color: '#111827',
        fontFamily: 'Courier',
    },
});
