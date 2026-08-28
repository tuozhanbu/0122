import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { APP_CONFIG } from '@/constants/config';
import { readInstallId } from '@/services/installIdentity';
import {
    MAX_CLIENT_ERROR_REPORT_BYTES,
} from '@/services/logging/clientErrors/constants';
import {
    readClientErrorCurrentRoute,
} from '@/services/logging/clientErrors/runtime';
import { readBreadcrumbs } from '@/services/logging/breadcrumbs';
import {
    normalizeLogError,
    sanitizeLogValue,
} from '@/services/logging/redaction/logEntries';
import { createUuidV4 } from '@/utils/uuid';

const readErrorMessage = (error) => {
    if (error instanceof Error) {
        return error.message;
    }

    if (typeof error === 'string') {
        return error;
    }

    return 'Non-error exception';
};

const getUtf8CharacterByteLength = (character) => {
    const codePoint = character.codePointAt(0);
    if (codePoint <= 0x7F) {
        return 1;
    }
    if (codePoint <= 0x7FF) {
        return 2;
    }
    if (codePoint <= 0xFFFF) {
        return 3;
    }
    return 4;
};

const getUtf8ByteLength = (text) => {
    let byteLength = 0;
    for (const character of text) {
        byteLength += getUtf8CharacterByteLength(character);
    }
    return byteLength;
};

const truncateTextToUtf8Bytes = (value, maximumByteLength) => {
    const text = String(value);
    if (getUtf8ByteLength(text) <= maximumByteLength) {
        return text;
    }

    const truncatedSuffix = '...[truncated]';
    const contentByteLimit = maximumByteLength - getUtf8ByteLength(truncatedSuffix);
    let content = '';
    let contentByteLength = 0;

    for (const character of text) {
        const characterByteLength = getUtf8CharacterByteLength(character);
        if (contentByteLength + characterByteLength > contentByteLimit) {
            break;
        }
        content += character;
        contentByteLength += characterByteLength;
    }

    return `${content}${truncatedSuffix}`;
};

const getSerializedReportByteLength = (report) => getUtf8ByteLength(JSON.stringify(report));

const buildMinimumClientErrorReport = (report) => ({
    reportId: truncateTextToUtf8Bytes(report.reportId, 128),
    installId: truncateTextToUtf8Bytes(report.installId, 128),
    occurredAt: truncateTextToUtf8Bytes(report.occurredAt, 64),
    appName: truncateTextToUtf8Bytes(report.appName, 128),
    appVersion: truncateTextToUtf8Bytes(report.appVersion, 128),
    platform: truncateTextToUtf8Bytes(report.platform, 64),
    systemVersion: truncateTextToUtf8Bytes(report.systemVersion, 128),
    deviceModel: truncateTextToUtf8Bytes(report.deviceModel, 128),
    errorName: truncateTextToUtf8Bytes(report.errorName, 256),
    message: truncateTextToUtf8Bytes(report.message, 512),
    stack: truncateTextToUtf8Bytes(report.stack, 2048),
    source: truncateTextToUtf8Bytes(report.source, 128),
    route: truncateTextToUtf8Bytes(report.route, 128),
    breadcrumbs: [],
    extra: { truncated: true },
});

export const fitClientErrorReportSize = (report) => {
    if (getSerializedReportByteLength(report) <= MAX_CLIENT_ERROR_REPORT_BYTES) {
        return report;
    }

    const nextReport = {
        ...report,
        stack: truncateTextToUtf8Bytes(report.stack ?? '', 8000),
        breadcrumbs: report.breadcrumbs.slice(-20),
        extra: {
            truncated: true,
        },
    };

    if (getSerializedReportByteLength(nextReport) <= MAX_CLIENT_ERROR_REPORT_BYTES) {
        return nextReport;
    }

    const reducedReport = {
        ...nextReport,
        message: truncateTextToUtf8Bytes(nextReport.message ?? '', 1000),
        stack: truncateTextToUtf8Bytes(nextReport.stack ?? '', 4000),
        breadcrumbs: [],
    };

    if (getSerializedReportByteLength(reducedReport) <= MAX_CLIENT_ERROR_REPORT_BYTES) {
        return reducedReport;
    }

    return buildMinimumClientErrorReport(reducedReport);
};

export const buildClientErrorReport = async (error, context = {}) => {
    const normalizedError = error instanceof Error
        ? normalizeLogError(error)
        : sanitizeLogValue(error);
    const errorObject = normalizedError && typeof normalizedError === 'object' && !Array.isArray(normalizedError)
        ? normalizedError
        : {};

    return {
        reportId: createUuidV4(),
        installId: await readInstallId(),
        occurredAt: new Date().toISOString(),
        appName: APP_CONFIG.name ?? '',
        appVersion: APP_CONFIG.version ?? '',
        platform: Platform.OS,
        systemVersion: `${Device.osName ?? ''} ${Device.osVersion ?? ''}`.trim(),
        deviceModel: Device.modelName ?? '',
        errorName: String(errorObject.name ?? error?.name ?? 'Error'),
        message: String(errorObject.message ?? readErrorMessage(error)),
        stack: String(errorObject.stack ?? error?.stack ?? ''),
        source: String(context.source ?? 'manual'),
        route: String(context.route ?? readClientErrorCurrentRoute() ?? ''),
        breadcrumbs: readBreadcrumbs(),
        extra: sanitizeLogValue(context.extra ?? {}),
    };
};

export const normalizeNativeCrashReport = async (report) => {
    const context = report.context && typeof report.context === 'object' && !Array.isArray(report.context)
        ? report.context
        : {};

    return fitClientErrorReportSize({
        reportId: String(report.reportId ?? createUuidV4()),
        installId: await readInstallId(),
        occurredAt: String(report.occurredAt ?? new Date().toISOString()),
        appName: APP_CONFIG.name ?? '',
        appVersion: String(report.appVersion ?? APP_CONFIG.version ?? ''),
        platform: String(report.platform ?? Platform.OS),
        systemVersion: String(report.systemVersion ?? ''),
        deviceModel: String(report.deviceModel ?? ''),
        errorName: String(report.errorName ?? 'NativeCrash'),
        message: String(report.message ?? ''),
        stack: String(report.stack ?? ''),
        source: String(report.source ?? 'native_crash'),
        route: String(context.route ?? ''),
        breadcrumbs: Array.isArray(context.breadcrumbs) ? context.breadcrumbs : [],
        extra: {
            nativeBuildVersion: report.nativeBuildVersion,
            thread: report.thread,
            diagnostic: report.diagnostic,
        },
    });
};

export const mergeClientErrorReportsById = (reports) => {
    const reportMap = new Map();
    reports.forEach((report) => {
        const reportId = String(report?.reportId ?? '');
        if (!reportId || reportMap.has(reportId)) {
            return;
        }
        reportMap.set(reportId, report);
    });
    return Array.from(reportMap.values());
};
