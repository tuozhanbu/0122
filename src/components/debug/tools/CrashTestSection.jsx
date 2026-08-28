import { useState } from 'react';
import {
    Alert,
    Platform,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import AppDebugToolButton from '@/components/debug/tools/ToolButton';
import { useAppDebugToast } from '@/components/debug/panel/ToastContext';
import { captureClientException } from '@/services/logging/clientErrors/capture';
import {
    triggerNativeCppExceptionTest,
    triggerNativeFatalCrashTest,
    triggerNativeObjectiveCExceptionTest,
} from '@/services/logging/clientErrors/nativeCrash/reports';
import { createLogger } from '@/utils/logger';

const logger = createLogger('AppDebugCrashTestSection');

function RenderCrashProbe({ crashId }) {
    if (crashId) {
        throw new Error(`Debug test render crash: ${crashId}`);
    }

    return null;
}

const confirmDangerousAction = ({ title, message, action }) => {
    Alert.alert(
        title,
        message,
        [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Run', style: 'destructive', onPress: action },
        ],
    );
};

export default function AppDebugCrashTestSection({ disabled }) {
    const showToast = useAppDebugToast();
    const [renderCrashId, setRenderCrashId] = useState('');

    const triggerFatalJsError = () => {
        confirmDangerousAction({
            title: 'Trigger JS Fatal Error?',
            message: 'The app may close in a release build or show a fatal error screen in development.',
            action: () => {
                setTimeout(() => {
                    throw new Error(`Debug test fatal JS error: ${new Date().toISOString()}`);
                }, 0);
            },
        });
    };

    const triggerReportedFatalError = () => {
        confirmDangerousAction({
            title: 'Report Fatal Error?',
            message: 'This calls ErrorUtils.reportFatalError. Expo Go usually shows a fatal error screen instead of killing the host app.',
            action: () => {
                const error = new Error(`Debug test reported fatal error: ${new Date().toISOString()}`);
                if (globalThis.ErrorUtils?.reportFatalError) {
                    globalThis.ErrorUtils.reportFatalError(error);
                    return;
                }
                throw error;
            },
        });
    };

    const triggerUnhandledPromiseRejection = () => {
        confirmDangerousAction({
            title: 'Trigger Unhandled Promise?',
            message: 'This tests the unhandled rejection capture path.',
            action: () => {
                Promise.reject(new Error(`Debug test unhandled promise rejection: ${new Date().toISOString()}`));
            },
        });
    };

    const triggerRenderError = () => {
        confirmDangerousAction({
            title: 'Trigger Render Error?',
            message: 'This tests the React error boundary capture path.',
            action: () => {
                setRenderCrashId(new Date().toISOString());
            },
        });
    };

    const triggerManualReport = () => {
        confirmDangerousAction({
            title: 'Record Test Error?',
            message: 'This records a client error without crashing the app.',
            action: async () => {
                try {
                    await captureClientException(new Error(`Debug test manual client error: ${new Date().toISOString()}`), {
                        source: 'debug_manual_test',
                        extra: {
                            triggeredFrom: 'Debug Tools',
                        },
                    });
                    showToast('Client error report saved.');
                } catch (error) {
                    logger.warn('manual client error test failed', { error });
                    Alert.alert('Record Failed', 'Please try again later.');
                }
            },
        });
    };

    const triggerNativeFatalCrash = () => {
        confirmDangerousAction({
            title: 'Trigger Native Fatal Crash?',
            message: 'This terminates the app in an Expo Dev Client or release build. It verifies the fatal signal or runtime crash collection path.',
            action: () => {
                triggerNativeFatalCrashTest().catch((error) => {
                    logger.warn('native crash test unavailable', { error });
                    Alert.alert('Native Test Unavailable', error?.message ?? 'Use an Expo Dev Client or release build.');
                });
            },
        });
    };

    const triggerNativeObjectiveCException = () => {
        confirmDangerousAction({
            title: 'Trigger Objective-C Exception?',
            message: 'This terminates the iOS app and verifies that the Objective-C exception name and reason are collected.',
            action: () => {
                triggerNativeObjectiveCExceptionTest().catch((error) => {
                    logger.warn('Objective-C exception test unavailable', { error });
                    Alert.alert('Native Test Unavailable', error?.message ?? 'Use an iOS Dev Client or release build.');
                });
            },
        });
    };

    const triggerNativeCppException = () => {
        confirmDangerousAction({
            title: 'Trigger C++ Exception?',
            message: 'This terminates the iOS app and verifies that the C++ exception type and reason are collected.',
            action: () => {
                triggerNativeCppExceptionTest().catch((error) => {
                    logger.warn('C++ exception test unavailable', { error });
                    Alert.alert('Native Test Unavailable', error?.message ?? 'Use an iOS Dev Client or release build.');
                });
            },
        });
    };

    return (
        <View style={styles.section}>
            <RenderCrashProbe crashId={renderCrashId} />
            <Text style={styles.sectionTitle}>Crash Tests</Text>
            <AppDebugToolButton
                danger
                disabled={disabled}
                icon="hardware-chip-outline"
                title="Native Fatal Crash"
                detail="iOS SIGABRT / Android runtime crash"
                onPress={triggerNativeFatalCrash}
            />
            {Platform.OS === 'ios' && (
                <>
                    <AppDebugToolButton
                        danger
                        disabled={disabled}
                        icon="logo-apple"
                        title="Objective-C Exception"
                        detail="Verify NSException name and reason"
                        onPress={triggerNativeObjectiveCException}
                    />
                    <AppDebugToolButton
                        danger
                        disabled={disabled}
                        icon="code-slash-outline"
                        title="C++ Exception"
                        detail="Verify C++ exception type and reason"
                        onPress={triggerNativeCppException}
                    />
                </>
            )}
            <AppDebugToolButton
                danger
                disabled={disabled}
                icon="bug-outline"
                title="JS Fatal Error"
                detail="Throw outside React render"
                onPress={triggerFatalJsError}
            />
            <AppDebugToolButton
                danger
                disabled={disabled}
                icon="skull-outline"
                title="Report Fatal Error"
                detail="Call ErrorUtils.reportFatalError"
                onPress={triggerReportedFatalError}
            />
            <AppDebugToolButton
                danger
                disabled={disabled}
                icon="alert-circle-outline"
                title="Unhandled Promise"
                detail="Reject without a catch handler"
                onPress={triggerUnhandledPromiseRejection}
            />
            <AppDebugToolButton
                danger
                disabled={disabled}
                icon="layers-outline"
                title="Render Error"
                detail="Throw during React render"
                onPress={triggerRenderError}
            />
            <AppDebugToolButton
                disabled={disabled}
                icon="document-text-outline"
                title="Manual Error Report"
                detail="Record without crashing"
                onPress={triggerManualReport}
            />
        </View>
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
        boxShadow: '0px 4px 12px rgba(15, 23, 42, 0.08)',
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
