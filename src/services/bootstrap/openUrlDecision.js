import { systemApi } from '@/services/api/system';
import {
    cacheAttributionDeepLinkParamsForJump,
    cacheOpenUrlRuleConfigForJump,
    getJumpFlag,
    isSupportedLinkType,
    setJumpFlag,
} from '@/services/openUrlJump';
import { createDebugLogger } from '@/utils/logger';
import { isEmpty } from '@/utils';
import {
    createInternalEntryAction,
    createOpenUrlJumpAction,
} from '@/services/bootstrap/actions';

const logger = createDebugLogger('DeferredJump');

const createInternalAction = (abTest, reason) => createInternalEntryAction({
    abTest: abTest ?? null,
    reason,
});

const createJumpAction = ({ linkType, targetUrl, abTest, attributionDeepLinkParams }) => createOpenUrlJumpAction({
    linkType,
    targetUrl,
    abTest: abTest ?? null,
    attributionDeepLinkParams,
});

export const resolveOpenUrlDecision = async ({
    openUrlRes,
    base,
    clipboardContent,
    attributionDeepLinkParams,
}) => {
    const data = openUrlRes?.data;
    if (isEmpty(data)) {
        logger.info('handleOpenUrl: empty data');
        return createInternalAction(null, 'empty_open_url_data');
    }

    const {
        fingerprint,
        isOpen,
        linkType,
        targetUrl,
        abTest,
        clipboardConfig: openUrlRuleConfig,
    } = data;
    const jumped = await getJumpFlag();
    const cacheOpenUrlJumpRequestState = async (nextLinkType, nextTargetUrl) => {
        await cacheOpenUrlRuleConfigForJump({
            openUrlRuleConfig,
            isOpen,
            linkType: nextLinkType,
            targetUrl: nextTargetUrl,
        });
        const attributionDeepLinkValue = String(attributionDeepLinkParams?.linkValue ?? '');
        await cacheAttributionDeepLinkParamsForJump({
            attributionDeepLinkParams: attributionDeepLinkValue === clipboardContent ? attributionDeepLinkParams : null,
            isOpen,
            linkType: nextLinkType,
            targetUrl: nextTargetUrl,
        });
    };

    if (isEmpty(targetUrl) && jumped === '1') {
        logger.info('handleOpenUrl: jumped=1 but empty targetUrl', { isOpen, linkType });
        return createInternalAction(abTest, 'jumped_empty_target');
    }

    if (jumped === '1') {
        const jumpedLinkType = String(linkType ?? '');
        if (!isSupportedLinkType(jumpedLinkType)) {
            logger.info('handleOpenUrl: jumped=1 but invalid linkType', { linkType });
            return createInternalAction(abTest, 'jumped_invalid_link_type');
        }

        // 本地已有命中标记时，只要返回 targetUrl 就直接分流
        logger.info('handleOpenUrl: jumped=1, jump now', { linkType: jumpedLinkType, targetUrl });
        await cacheOpenUrlJumpRequestState(jumpedLinkType, targetUrl);
        return createJumpAction({
            linkType: jumpedLinkType,
            targetUrl,
            abTest,
            attributionDeepLinkParams,
        });
    }

    const checkTimeSeconds = Number(base.checkTime ?? 0);
    const normalizedLinkType = String(linkType ?? '');
    const canJump = isSupportedLinkType(normalizedLinkType);

    if (isOpen !== '1') {
        logger.info('handleOpenUrl: isOpen!=1, no jump', {
            isOpen,
            linkType,
            checkTimeSeconds,
        });
        return createInternalAction(abTest, 'is_open_disabled');
    }

    if (isEmpty(targetUrl)) {
        logger.info('handleOpenUrl: empty targetUrl', { isOpen, linkType, checkTimeSeconds });
        return createInternalAction(abTest, 'empty_target');
    }

    // 非静默：isOpen 已确认开启，checkTime <= 0 时立即跳转
    if (Number.isFinite(checkTimeSeconds) && checkTimeSeconds <= 0) {
        if (!canJump) {
            logger.info('handleOpenUrl: checkTime<=0 but invalid linkType, no jump', { linkType });
            return createInternalAction(abTest, 'invalid_link_type');
        }

        if (fingerprint) {
            systemApi.fingerprintDelete(fingerprint).catch(() => { });
        }
        await setJumpFlag();
        await cacheOpenUrlJumpRequestState(normalizedLinkType, targetUrl);
        logger.info('handleOpenUrl: checkTime<=0 immediate, jump now', { linkType: normalizedLinkType, targetUrl });
        return createJumpAction({
            linkType: normalizedLinkType,
            targetUrl,
            abTest,
            attributionDeepLinkParams,
        });
    }

    logger.info('handleOpenUrl: no jump', { isOpen, linkType, checkTimeSeconds });
    return createInternalAction(abTest, 'no_jump');
};
