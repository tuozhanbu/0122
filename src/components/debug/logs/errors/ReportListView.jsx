import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LogActionButton } from '@/components/debug/logs/LogControls';
import { formatClientErrorEntry } from '@/components/debug/logs/formatEntries';

const surfaceShadow = {
    boxShadow: '0px 4px 12px rgba(15, 23, 42, 0.08)',
};

function ErrorReportRow({ report, disabled, onPress }) {
    return (
        <TouchableOpacity
            activeOpacity={0.78}
            disabled={disabled}
            onPress={onPress}
            style={styles.reportRow}
        >
            <Text style={styles.reportText} numberOfLines={4}>{formatClientErrorEntry(report)}</Text>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
        </TouchableOpacity>
    );
}

export default function ErrorLogReportListView({
    loading,
    pendingCount,
    reports,
    onRefresh,
    onClear,
    onOpenReport,
}) {
    return (
        <View style={styles.page}>
            <View style={styles.actions}>
                <LogActionButton disabled={loading} icon="refresh-outline" title="Refresh" onPress={onRefresh} />
                <LogActionButton danger disabled={loading} icon="trash-outline" title="Clear" onPress={onClear} />
            </View>

            <View style={styles.pendingSummary}>
                <Text style={styles.pendingLabel}>Pending Uploads</Text>
                <Text style={styles.pendingValue}>{pendingCount}</Text>
            </View>

            <View style={styles.reportList}>
                <View style={styles.reportListHeader}>
                    <Text style={styles.reportListTitle}>Error History</Text>
                    <Text style={styles.reportListCount}>{reports.length}</Text>
                </View>
                <ScrollView style={styles.reportScroll} contentContainerStyle={styles.reportScrollContent}>
                    {reports.length === 0 ? (
                        <Text style={styles.emptyText}>{loading ? 'Loading...' : 'No logs'}</Text>
                    ) : reports.map((report, index) => (
                        <ErrorReportRow
                            key={`${report.reportId ?? report.occurredAt ?? index}-${index}`}
                            disabled={loading}
                            report={report}
                            onPress={() => onOpenReport(report.reportId)}
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
    pendingSummary: {
        minHeight: 44,
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#CBD3DF',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 14,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        ...surfaceShadow,
    },
    pendingLabel: {
        fontSize: 13,
        fontWeight: '800',
        color: '#4B5563',
    },
    pendingValue: {
        fontSize: 14,
        fontWeight: '800',
        color: '#111827',
    },
    reportList: {
        flex: 1,
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#CBD3DF',
        backgroundColor: '#FFFFFF',
        overflow: 'hidden',
        ...surfaceShadow,
    },
    reportListHeader: {
        minHeight: 38,
        paddingHorizontal: 14,
        backgroundColor: '#F8FAFC',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#E2E8F0',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    reportListTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: '#4B5563',
        textTransform: 'uppercase',
    },
    reportListCount: {
        fontSize: 12,
        fontWeight: '800',
        color: '#64748B',
    },
    reportScroll: {
        flex: 1,
    },
    reportScrollContent: {
        paddingBottom: 10,
    },
    emptyText: {
        paddingHorizontal: 14,
        paddingVertical: 18,
        fontSize: 13,
        color: '#64748B',
    },
    reportRow: {
        minHeight: 72,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#E2E6EC',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    reportText: {
        flex: 1,
        fontSize: 11,
        lineHeight: 16,
        color: '#111827',
        fontFamily: 'Courier',
    },
});
