import { useState } from 'react';
import {
    StyleSheet,
    View,
} from 'react-native';
import DebugLogSessionsView from '@/components/debug/logs/debug/SessionsView';
import ErrorLogReportsView from '@/components/debug/logs/errors/ReportsView';
import { LogModeButton } from '@/components/debug/logs/LogControls';

const LOG_KIND_DEBUG = 'debug';
const LOG_KIND_ERRORS = 'errors';

const surfaceShadow = {
    boxShadow: '0px 4px 12px rgba(15, 23, 42, 0.08)',
};

export default function DebugLogsView() {
    const [kind, setKind] = useState(LOG_KIND_DEBUG);

    return (
        <View style={styles.content}>
            <View style={styles.modeBar}>
                <LogModeButton
                    active={kind === LOG_KIND_DEBUG}
                    title="Debug"
                    onPress={() => setKind(LOG_KIND_DEBUG)}
                />
                <LogModeButton
                    active={kind === LOG_KIND_ERRORS}
                    title="Errors"
                    onPress={() => setKind(LOG_KIND_ERRORS)}
                />
            </View>

            <View style={styles.page}>
                {kind === LOG_KIND_DEBUG ? <DebugLogSessionsView /> : <ErrorLogReportsView />}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    content: {
        flex: 1,
        paddingHorizontal: 10,
        paddingTop: 10,
        paddingBottom: 10,
    },
    page: {
        flex: 1,
    },
    modeBar: {
        minHeight: 42,
        padding: 4,
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#CBD3DF',
        backgroundColor: '#FFFFFF',
        flexDirection: 'row',
        marginBottom: 10,
        ...surfaceShadow,
    },
});
