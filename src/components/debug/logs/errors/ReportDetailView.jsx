import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
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
    formatClientErrorBreadcrumb,
    formatClientErrorDetail,
} from '@/components/debug/logs/formatEntries';
import { useAppDebugToast } from '@/components/debug/panel/ToastContext';
import { createLogger } from '@/utils/logger';

const logger = createLogger('ErrorLogReportDetailView');

const surfaceShadow = {
    boxShadow: '0px 4px 12px rgba(15, 23, 42, 0.08)',
};

function DetailSection({ title, children }) {
    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>{title}</Text>
            {children}
        </View>
    );
}

function DetailText({ children, emptyText = 'No data' }) {
    const text = String(children ?? '');
    return (
        <Text style={text ? styles.reportText : styles.emptyText} selectable>
            {text || emptyText}
        </Text>
    );
}

export default function ErrorLogReportDetailView({ loading, report, onBack, onRefresh }) {
    const showToast = useAppDebugToast();
    const breadcrumbs = Array.isArray(report.breadcrumbs) ? report.breadcrumbs : [];

    const copyReport = async () => {
        if (loading) return;
        try {
            await Clipboard.setStringAsync(formatClientErrorDetail(report));
            showToast('Error report copied.');
        } catch (error) {
            logger.warn('copy error report failed', { error });
            Alert.alert('Copy Failed', 'Please try again later.');
        }
    };

    return (
        <View style={styles.page}>
            <View style={styles.detailHeader}>
                <TouchableOpacity activeOpacity={0.78} onPress={onBack} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={18} color="#0F766E" />
                    <Text style={styles.backButtonText}>Errors</Text>
                </TouchableOpacity>
                <Text style={styles.detailTitle} numberOfLines={1}>{report.reportId}</Text>
            </View>

            <View style={styles.actions}>
                <LogActionButton disabled={loading} icon="refresh-outline" title="Refresh" onPress={onRefresh} />
                <LogActionButton disabled={loading} icon="copy-outline" title="Copy" onPress={copyReport} />
            </View>

            <View style={styles.detailCard}>
                <ScrollView style={styles.reportScroll} contentContainerStyle={styles.reportScrollContent}>
                    <DetailSection title="Summary">
                        <DetailText>
                            {[
                                `${report.errorName ?? 'Error'}: ${report.message ?? ''}`,
                                `Source: ${report.source ?? ''}`,
                                `Route: ${report.route ?? ''}`,
                                `Time: ${report.occurredAt ?? ''}`,
                                `Report: ${report.reportId ?? ''}`,
                                `App: ${report.appName ?? ''} ${report.appVersion ?? ''}`.trim(),
                                `Platform: ${report.platform ?? ''} ${report.systemVersion ?? ''}`.trim(),
                                `Device: ${report.deviceModel ?? ''}`.trim(),
                            ].filter(Boolean).join('\n')}
                        </DetailText>
                    </DetailSection>

                    <DetailSection title="Stack">
                        <DetailText emptyText="No stack captured">{report.stack}</DetailText>
                    </DetailSection>

                    <DetailSection title={`Breadcrumbs (${breadcrumbs.length})`}>
                        {breadcrumbs.length === 0 ? (
                            <Text style={styles.emptyText}>No breadcrumbs captured</Text>
                        ) : breadcrumbs.map((breadcrumb, index) => (
                            <Text
                                key={`${breadcrumb.time ?? ''}-${breadcrumb.name ?? ''}-${index}`}
                                style={styles.breadcrumbText}
                                selectable
                            >
                                {formatClientErrorBreadcrumb(breadcrumb)}
                            </Text>
                        ))}
                    </DetailSection>

                    <DetailSection title="Extra">
                        <DetailText emptyText="No extra data">
                            {JSON.stringify(report.extra ?? {}, null, 2)}
                        </DetailText>
                    </DetailSection>
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
    detailCard: {
        flex: 1,
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#CBD3DF',
        backgroundColor: '#FFFFFF',
        overflow: 'hidden',
        ...surfaceShadow,
    },
    reportScroll: {
        flex: 1,
    },
    reportScrollContent: {
        padding: 14,
        paddingBottom: 10,
    },
    section: {
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 12,
        lineHeight: 16,
        fontWeight: '800',
        color: '#4B5563',
        textTransform: 'uppercase',
        marginBottom: 6,
    },
    reportText: {
        fontSize: 11,
        lineHeight: 16,
        color: '#111827',
        fontFamily: 'Courier',
    },
    breadcrumbText: {
        fontSize: 11,
        lineHeight: 16,
        color: '#111827',
        fontFamily: 'Courier',
        paddingVertical: 4,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#E2E8F0',
    },
    emptyText: {
        fontSize: 12,
        lineHeight: 16,
        color: '#64748B',
    },
});
