import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    readAsyncStorageKeys,
    readAsyncStorageValue,
} from '@/services/appDebug/storage';
import { createLogger } from '@/utils/logger';

const logger = createLogger('AppDebugStorage');

const surfaceShadow = {
    boxShadow: '0px 4px 12px rgba(15, 23, 42, 0.08)',
};

export default function AppDebugStorageView() {
    const insets = useSafeAreaInsets();
    const [storageKeys, setStorageKeys] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadFailed, setLoadFailed] = useState(false);
    const [expandedKey, setExpandedKey] = useState(null);
    const [expandedValue, setExpandedValue] = useState(null);
    const [loadingValue, setLoadingValue] = useState(false);
    const [valueLoadFailed, setValueLoadFailed] = useState(false);
    const valueRequestIdRef = useRef(0);

    const refreshStorageKeys = useCallback(async () => {
        setLoading(true);
        setLoadFailed(false);
        try {
            setStorageKeys(await readAsyncStorageKeys());
        } catch (error) {
            logger.warn('read AsyncStorage keys failed', { error });
            setLoadFailed(true);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refreshStorageKeys();
    }, [refreshStorageKeys]);

    const toggleStorageKey = async (key) => {
        if (expandedKey === key) {
            valueRequestIdRef.current += 1;
            setExpandedKey(null);
            return;
        }

        const requestId = valueRequestIdRef.current + 1;
        valueRequestIdRef.current = requestId;
        setExpandedKey(key);
        setExpandedValue(null);
        setLoadingValue(true);
        setValueLoadFailed(false);
        try {
            const value = await readAsyncStorageValue(key);
            if (valueRequestIdRef.current !== requestId) {
                return;
            }
            setExpandedValue(value);
        } catch (error) {
            if (valueRequestIdRef.current !== requestId) {
                return;
            }
            logger.warn('read AsyncStorage value failed', { key, error });
            setValueLoadFailed(true);
        } finally {
            if (valueRequestIdRef.current === requestId) {
                setLoadingValue(false);
            }
        }
    };

    return (
        <View style={styles.content}>
            <View style={styles.toolbar}>
                <View>
                    <Text style={styles.title}>AsyncStorage Keys</Text>
                    <Text style={styles.count}>{storageKeys.length} keys</Text>
                </View>
                <TouchableOpacity
                    activeOpacity={0.78}
                    disabled={loading}
                    onPress={refreshStorageKeys}
                    style={[styles.refreshButton, loading && styles.refreshButtonDisabled]}
                >
                    {loading
                        ? <ActivityIndicator color="#0F766E" size="small" />
                        : <Ionicons color="#0F766E" name="refresh-outline" size={20} />}
                    <Text style={styles.refreshLabel}>Refresh</Text>
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.list}
                contentContainerStyle={[styles.listInner, { paddingBottom: insets.bottom + 92 }]}
            >
                {loadFailed && (
                    <View style={styles.messageCard}>
                        <Text style={styles.messageTitle}>Unable to load storage keys</Text>
                        <Text style={styles.messageDetail}>Tap Refresh to try again.</Text>
                    </View>
                )}
                {!loading && !loadFailed && storageKeys.length === 0 && (
                    <View style={styles.messageCard}>
                        <Text style={styles.messageTitle}>No storage keys</Text>
                    </View>
                )}
                {!loadFailed && storageKeys.map((key) => (
                    <View
                        key={key}
                        style={[styles.keyCard, expandedKey === key && styles.keyCardExpanded]}
                    >
                        <TouchableOpacity
                            activeOpacity={0.78}
                            onPress={() => toggleStorageKey(key)}
                            style={styles.keyRow}
                        >
                            <Text selectable style={styles.keyText}>{key}</Text>
                            <Ionicons
                                color="#94A3B8"
                                name={expandedKey === key ? 'chevron-up' : 'chevron-down'}
                                size={18}
                            />
                        </TouchableOpacity>
                        {expandedKey === key && (
                            <View style={styles.valueContent}>
                                <Text style={styles.valueLabel}>VALUE</Text>
                                {loadingValue && <ActivityIndicator color="#0F766E" size="small" />}
                                {valueLoadFailed && (
                                    <Text style={styles.valueMessage}>Unable to load this value.</Text>
                                )}
                                {!loadingValue && !valueLoadFailed && expandedValue === null && (
                                    <Text style={styles.valueMessage}>This key no longer exists.</Text>
                                )}
                                {!loadingValue && !valueLoadFailed && expandedValue !== null && (
                                    <Text selectable style={styles.valueText}>{expandedValue}</Text>
                                )}
                            </View>
                        )}
                    </View>
                ))}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    content: {
        flex: 1,
        paddingHorizontal: 10,
        paddingTop: 10,
    },
    toolbar: {
        minHeight: 62,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#CBD3DF',
        backgroundColor: '#FFFFFF',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
        ...surfaceShadow,
    },
    title: {
        fontSize: 15,
        fontWeight: '800',
        color: '#111827',
        marginBottom: 3,
    },
    count: {
        fontSize: 12,
        color: '#64748B',
    },
    refreshButton: {
        minHeight: 36,
        paddingHorizontal: 10,
        borderRadius: 6,
        backgroundColor: '#E6F7F4',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
    },
    refreshButtonDisabled: {
        opacity: 0.58,
    },
    refreshLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0F766E',
    },
    list: {
        flex: 1,
    },
    listInner: {
        gap: 8,
    },
    keyCard: {
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#CBD3DF',
        backgroundColor: '#FFFFFF',
        overflow: 'hidden',
        ...surfaceShadow,
    },
    keyCardExpanded: {
        borderColor: '#0F766E',
        backgroundColor: '#F0FDFA',
    },
    keyRow: {
        minHeight: 44,
        paddingHorizontal: 14,
        paddingVertical: 11,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    keyText: {
        flex: 1,
        minWidth: 0,
        fontSize: 13,
        lineHeight: 20,
        color: '#111827',
        fontFamily: 'Courier',
    },
    valueContent: {
        paddingHorizontal: 14,
        paddingTop: 10,
        paddingBottom: 14,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#99F6E4',
    },
    valueLabel: {
        marginBottom: 6,
        fontSize: 11,
        fontWeight: '800',
        color: '#4B5563',
    },
    valueText: {
        padding: 10,
        borderRadius: 6,
        backgroundColor: '#FFFFFF',
        fontSize: 12,
        lineHeight: 18,
        color: '#111827',
        fontFamily: 'Courier',
    },
    valueMessage: {
        fontSize: 12,
        lineHeight: 18,
        color: '#64748B',
    },
    messageCard: {
        minHeight: 72,
        paddingHorizontal: 14,
        paddingVertical: 14,
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#CBD3DF',
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        ...surfaceShadow,
    },
    messageTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111827',
    },
    messageDetail: {
        marginTop: 4,
        fontSize: 12,
        color: '#64748B',
    },
});
