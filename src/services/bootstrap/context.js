import { initDomain } from '@/services/domainSelector';
import { systemApi } from '@/services/api/system';
import { configureAppDebugFromInit, loadStoredAppDebugState } from '@/services/appDebug/store';
import { initializeInstallIdentity } from '@/services/installIdentity';
import { flushClientErrorReportsWhenDue } from '@/services/logging/clientErrors/uploadSchedule';
import { recordBreadcrumb } from '@/services/logging/breadcrumbs';
import {
    beginAttributionOpenUrlDecision,
    canOverrideCachedAttributionDeepLinkParams,
    canUseAttributionClipboardFallback,
    configureAttributionReporter,
    readStartupAttributionDeepLinkParams,
    startAttributionReporter,
} from '@/services/attribution/reporter';
import { replaceCachedAttributionDeepLinkParams } from '@/services/openUrlJump';
import { createDebugLogger } from '@/utils/logger';

const logger = createDebugLogger('DeferredJump');

const assertPlainObject = (value, message) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(message);
    }
};

const parseInitContext = (initRes) => {
    const initData = initRes?.data;
    assertPlainObject(initData, 'Invalid /system/init response: data must be an object');
    assertPlainObject(initData.base, 'Invalid /system/init response: base must be an object');

    return {
        initData,
        base: initData.base,
        attributionConfig: initData.attribution ?? null,
    };
};

export const prepareBootstrapContext = async ({
    initUser,
    initLang,
    setBootstrapBase,
}) => {
    logger.info('bootstrap: start');
    recordBreadcrumb({
        category: 'bootstrap',
        name: 'bootstrap.start',
    });

    // 本地状态是后续 init 与内部入口分流的前置条件，失败交给启动页错误态处理。
    logger.info('bootstrap: init local state');
    const [installIdentity] = await Promise.all([
        initializeInstallIdentity(),
        initUser(),
        initLang(),
    ]);
    logger.info('bootstrap: init local state done');
    recordBreadcrumb({
        category: 'bootstrap',
        name: 'bootstrap.local_state_ready',
    });

    logger.info('bootstrap: initDomain');
    await initDomain();
    logger.info('bootstrap: initDomain done');
    recordBreadcrumb({
        category: 'bootstrap',
        name: 'bootstrap.domain_ready',
    });
    flushClientErrorReportsWhenDue().catch((error) => {
        logger.warn('client error flush failed', { error });
    });

    const storedAppDebugState = await loadStoredAppDebugState();
    logger.info('bootstrap: api.init');
    const initRes = await systemApi.init();
    const { initData, base, attributionConfig } = parseInitContext(initRes);

    await configureAppDebugFromInit(initData, storedAppDebugState);
    configureAttributionReporter(attributionConfig);
    beginAttributionOpenUrlDecision({
        reason: 'bootstrap',
        waitForInstallConversion: !installIdentity.restoredInstallIdentity,
    });
    startAttributionReporter();
    logger.info('bootstrap: api.init done', {
        checkTime: base.checkTime,
        readClipboard: base.readClipboard,
        attributionClipboardFallbackEnabled: canUseAttributionClipboardFallback(attributionConfig),
    });
    recordBreadcrumb({
        category: 'bootstrap',
        name: 'bootstrap.init_success',
        data: {
            checkTime: base.checkTime,
            readClipboard: base.readClipboard,
            hasDebugConfig: Object.prototype.hasOwnProperty.call(initData, 'debug'),
            attributionClipboardFallbackEnabled: canUseAttributionClipboardFallback(attributionConfig),
        },
    });
    // 进入内部页面后会基于这份 init.base 补拉语言包。
    setBootstrapBase(base);

    if (canOverrideCachedAttributionDeepLinkParams(attributionConfig)) {
        logger.info('bootstrap: attribution deep link cache override enabled');
        const attributionDeepLinkParams = await readStartupAttributionDeepLinkParams();
        await replaceCachedAttributionDeepLinkParams(attributionDeepLinkParams);
    }

    return {
        base,
        attributionConfig,
    };
};
