import { APP_STORAGE_KEYS } from '@/constants/storageKeys';
import { CLIENT_ERROR_UPLOAD_RETRY_DELAY_MS } from '@/services/logging/clientErrors/constants';
import { flushPendingClientErrors } from '@/services/logging/clientErrors/upload';
import { flushPendingNativeCrashReports } from '@/services/logging/clientErrors/nativeCrash/reports';
import { removeItemOrThrow, setItemOrThrow, tryGetItem } from '@/utils/storage';
import { createDebugLogger } from '@/utils/logger';

const logger = createDebugLogger('ClientErrorUploadSchedule');

const CLIENT_ERROR_UPLOAD_SCHEDULE_STATE_KEY = '__APP_CLIENT_ERROR_UPLOAD_SCHEDULE__';

const uploadScheduleState = (() => {
    if (!globalThis[CLIENT_ERROR_UPLOAD_SCHEDULE_STATE_KEY]) {
        globalThis[CLIENT_ERROR_UPLOAD_SCHEDULE_STATE_KEY] = {
            pendingFlush: null,
        };
    }

    return globalThis[CLIENT_ERROR_UPLOAD_SCHEDULE_STATE_KEY];
})();

const readUploadState = async () => {
    const state = await tryGetItem(APP_STORAGE_KEYS.clientError.uploadState);
    return state && typeof state === 'object' && !Array.isArray(state) ? state : {};
};

const recordUploadFailure = async (error, now) => {
    const failedCount = Number((await readUploadState()).failedCount ?? 0);
    await setItemOrThrow(APP_STORAGE_KEYS.clientError.uploadState, {
        failedCount: Number.isFinite(failedCount) ? failedCount + 1 : 1,
        lastFailedAt: now,
        nextUploadAt: now + CLIENT_ERROR_UPLOAD_RETRY_DELAY_MS,
        lastError: String(error?.message ?? error ?? 'Upload failed').slice(0, 300),
    });
};

const flushClientErrorReportsWhenDueOnce = async () => {
    const now = Date.now();
    const uploadState = await readUploadState();
    const nextUploadAt = Number(uploadState.nextUploadAt ?? 0);

    if (Number.isFinite(nextUploadAt) && nextUploadAt > now) {
        logger.info('client error upload skipped by cooldown', {
            nextUploadAt,
        });
        return { sent: 0, skipped: true, reason: 'cooldown' };
    }

    try {
        await flushPendingNativeCrashReports().catch((error) => {
            logger.warn('native crash flush failed', { error });
        });
        const result = await flushPendingClientErrors();
        await removeItemOrThrow(APP_STORAGE_KEYS.clientError.uploadState);
        return { ...result, skipped: false };
    } catch (error) {
        await recordUploadFailure(error, now).catch((stateError) => {
            logger.warn('client error upload state save failed', { error: stateError });
        });
        throw error;
    }
};

export const flushClientErrorReportsWhenDue = async () => {
    if (uploadScheduleState.pendingFlush) {
        return await uploadScheduleState.pendingFlush;
    }

    uploadScheduleState.pendingFlush = flushClientErrorReportsWhenDueOnce();
    try {
        return await uploadScheduleState.pendingFlush;
    } finally {
        uploadScheduleState.pendingFlush = null;
    }
};

/** 等待已开始的上报完成；清理操作不应因上报结果而中断。 */
export const waitForActiveClientErrorUpload = async () => {
    const activeFlush = uploadScheduleState.pendingFlush;
    if (!activeFlush) {
        return;
    }

    await activeFlush.then(
        () => undefined,
        () => undefined,
    );
};
