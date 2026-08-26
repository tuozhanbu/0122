import { useMemo } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppDebugSnapshot } from '@/services/appDebug/store';
import {
    buildAppDebugDiagnosticsSections,
    formatAppDebugValue,
} from '@/services/appDebug/diagnostics';

const surfaceShadow = {
    boxShadow: '0px 4px 12px rgba(15, 23, 42, 0.08)',
};
function DebugRow({ label, value }) {
    const formattedValue = formatAppDebugValue(value);
    const multiline = formattedValue.includes('\n');

    return (
        <View style={[styles.row, multiline && styles.multilineRow]}>
            <Text style={[styles.rowLabel, multiline && styles.multilineRowLabel]}>{label}</Text>
            <Text style={[styles.rowValue, multiline && styles.multilineRowValue]} selectable>
                {formattedValue}
            </Text>
        </View>
    );
}

function DebugSection({ title, rows }) {
    return (
        <View style={styles.section}>
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{title}</Text>
            </View>
            {rows.map((row) => (
                <DebugRow key={row.label} label={row.label} value={row.value} />
            ))}
        </View>
    );
}

export default function AppDebugInfoView() {
    const insets = useSafeAreaInsets();
    const appDebug = useAppDebugSnapshot();

    const sections = useMemo(() => buildAppDebugDiagnosticsSections(appDebug), [appDebug]);

    return (
        <ScrollView
            style={styles.content}
            contentContainerStyle={[styles.contentInner, { paddingBottom: insets.bottom + 92 }]}
        >
            <View style={[styles.summary, appDebug.enabled ? styles.summaryOn : styles.summaryOff]}>
                <View style={[
                    styles.statusMark,
                    appDebug.enabled ? styles.statusMarkOn : styles.statusMarkOff,
                ]} />
                <View style={styles.summaryText}>
                    <Text style={styles.summaryTitle}>
                        {appDebug.enabled ? 'Debug Enabled' : 'Debug Disabled'}
                    </Text>
                    <Text style={styles.summaryMeta} selectable>
                        {appDebug.sessionId ? appDebug.sessionId : 'Session missing'}
                    </Text>
                </View>
            </View>

            {sections.map((section) => (
                <DebugSection key={section.title} title={section.title} rows={section.rows} />
            ))}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    content: {
        flex: 1,
    },
    contentInner: {
        paddingHorizontal: 10,
        paddingTop: 10,
    },
    summary: {
        minHeight: 72,
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#CBD3DF',
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        ...surfaceShadow,
    },
    summaryOn: {
        backgroundColor: '#F0FDF4',
        borderColor: '#B7E4C7',
    },
    summaryOff: {
        backgroundColor: '#FFFFFF',
    },
    statusMark: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: 12,
    },
    statusMarkOn: {
        backgroundColor: '#16A34A',
    },
    statusMarkOff: {
        backgroundColor: '#9CA3AF',
    },
    summaryText: {
        flex: 1,
    },
    summaryTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: '#111827',
        marginBottom: 4,
    },
    summaryMeta: {
        fontSize: 12,
        color: '#64748B',
        lineHeight: 17,
    },
    section: {
        marginBottom: 10,
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#CBD3DF',
        backgroundColor: '#FFFFFF',
        ...surfaceShadow,
    },
    sectionHeader: {
        minHeight: 38,
        paddingHorizontal: 14,
        justifyContent: 'center',
        backgroundColor: '#F8FAFC',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#E2E8F0',
        borderTopLeftRadius: 8,
        borderTopRightRadius: 8,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: '#4B5563',
        textTransform: 'uppercase',
    },
    row: {
        minHeight: 40,
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#E2E6EC',
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
    },
    rowLabel: {
        width: 104,
        fontSize: 13,
        color: '#6B7280',
        lineHeight: 20,
    },
    rowValue: {
        flex: 1,
        minWidth: 0,
        fontSize: 13,
        color: '#111827',
        lineHeight: 20,
    },
    multilineRow: {
        alignItems: 'flex-start',
    },
    multilineRowLabel: {
        fontWeight: '700',
    },
    multilineRowValue: {
        flex: 1,
        minWidth: 0,
        padding: 10,
        borderRadius: 6,
        backgroundColor: '#F8FAFC',
        fontFamily: 'Courier',
        fontSize: 12,
        lineHeight: 17,
    },
});
