import { resolveInternalEntryRoute } from '@/services/internalEntryRoute';
import { jumpByLinkType } from '@/services/openUrlJump';
import { BOOTSTRAP_ACTION_TYPES } from '@/services/bootstrap/actions';
import { createDebugLogger } from '@/utils/logger';

const logger = createDebugLogger('DeferredJump');

export const replaceInternalEntry = async (router, abTest) => {
    const route = await resolveInternalEntryRoute(abTest);
    logger.info('route: replace internal entry', { route, abTest: String(abTest ?? '') });
    router.replace(route);
    return { didJump: false };
};

export const executeBootstrapAction = async (router, action) => {
    if (!action || typeof action !== 'object') {
        throw new Error('Invalid bootstrap action');
    }

    if (action.type === BOOTSTRAP_ACTION_TYPES.OPEN_URL_JUMP) {
        const type = await jumpByLinkType({
            router,
            linkType: action.linkType,
            targetUrl: action.targetUrl,
            attributionDeepLinkParams: action.attributionDeepLinkParams,
        });
        if (type === 'webview') {
            return { didJump: true };
        }
        if (type === 'external') {
            await replaceInternalEntry(router, action.abTest);
            return { didJump: true };
        }

        throw new Error('OpenUrl jump action was not executable');
    }

    if (action.type === BOOTSTRAP_ACTION_TYPES.INTERNAL_ENTRY) {
        return replaceInternalEntry(router, action.abTest);
    }

    throw new Error(`Unsupported bootstrap action type: ${String(action.type)}`);
};
