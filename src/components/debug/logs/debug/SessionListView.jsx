import { Ionicons } from '@expo/vector-icons';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { LogActionButton } from '@/components/debug/logs/LogControls';
import { formatDebugLogSessionLabel } from '@/components/debug/logs/formatEntries';

const surfaceShadow = {
    boxShadow: '0px 4px 12px rgba(15, 23, 42, 0.08)',
};

function DebugSessionRow({ session, onPress, onDelete, disabled }) {
    return (
        <View style={styles.sessionRow}>
            <TouchableOpacity
                activeOpacity={0.78}
                disabled={disabled}
                onPress={onPress}
                style={styles.sessionRowMain}
            >
                <Text style={styles.sessionRowTitle}>{formatDebugLogSessionLabel(session)}</Text>
                <Text style={styles.sessionRowMeta}>{session.fileName} · {Math.round(session.size / 1024)} KB</Text>
            </TouchableOpacity>
            <TouchableOpacity
                activeOpacity={0.78}
                disabled={disabled}
                onPress={onDelete}
                style={styles.sessionDeleteButton}
            >
                <Ionicons name="trash-outline" size={18} color="#B42318" />
            </TouchableOpacity>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
        </View>
    );
}

export default function DebugLogSessionListView({
    loading,
    sessions,
    onRefresh,
    onClear,
    onOpenSession,
    onDeleteSession,
}) {
    return (
        <View style={styles.page}>
            <View style={styles.actions}>
                <LogActionButton disabled={loading} icon="refresh-outline" title="Refresh" onPress={onRefresh} />
                <LogActionButton danger disabled={loading} icon="trash-outline" title="Clear" onPress={onClear} />
            </View>

            <View style={styles.listCard}>
                <View style={styles.listHeader}>
                    <Text style={styles.listTitle}>Launches</Text>
                    <Text style={styles.listCount}>{sessions.length}</Text>
                </View>
                <ScrollView style={styles.listScroll} contentContainerStyle={styles.listScrollContent}>
                    {sessions.length === 0 ? (
                        <Text style={styles.emptyText}>{loading ? 'Loading...' : 'No logs'}</Text>
                    ) : sessions.map((session) => (
                        <DebugSessionRow
                            key={session.id}
                            disabled={loading}
                            session={session}
                            onPress={() => onOpenSession(session.id)}
                            onDelete={() => onDeleteSession(session.id)}
                        />
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
    actions: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 10,
    },
    listCard: {
        flex: 1,
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#CBD3DF',
        backgroundColor: '#FFFFFF',
        overflow: 'hidden',
        ...surfaceShadow,
    },
    listHeader: {
        minHeight: 38,
        paddingHorizontal: 14,
        backgroundColor: '#F8FAFC',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#E2E8F0',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    listTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: '#4B5563',
        textTransform: 'uppercase',
    },
    listCount: {
        fontSize: 12,
        fontWeight: '800',
        color: '#64748B',
    },
    listScroll: {
        flex: 1,
    },
    listScrollContent: {
        paddingBottom: 10,
    },
    emptyText: {
        paddingHorizontal: 14,
        paddingVertical: 18,
        fontSize: 13,
        color: '#64748B',
    },
    sessionRow: {
        minHeight: 64,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#E2E6EC',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    sessionRowMain: {
        flex: 1,
        minHeight: 42,
        justifyContent: 'center',
    },
    sessionRowTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: '#111827',
        marginBottom: 3,
    },
    sessionRowMeta: {
        fontSize: 11,
        color: '#64748B',
    },
    sessionDeleteButton: {
        width: 34,
        height: 34,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FEF3F2',
    },
});
