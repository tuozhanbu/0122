const WEB_VIEW_PRESENTATION_PARAM_KEYS = [
    'fullScreen',
    'showFloatButton',
    'topSafeAreaEnabled',
    'bottomSafeAreaEnabled',
    'backgroundColor',
    'statusBarStyle',
    'screenOrientation',
];

const WEB_VIEW_STATUS_BAR_STYLES = new Set(['auto', 'dark', 'light']);
const WEB_VIEW_SCREEN_ORIENTATIONS = new Set(['auto', 'portrait', 'landscape']);
const ARGB_COLOR_PATTERN = /^0x[\dA-Fa-f]{8}$/;

export function isWebViewScreenOrientation(screenOrientation) {
    return WEB_VIEW_SCREEN_ORIENTATIONS.has(screenOrientation);
}

export function parseWebViewPresentation(params) {
    if (!params || typeof params !== 'object' || Array.isArray(params)) {
        return null;
    }

    const paramKeys = Object.keys(params);
    const hasExpectedParamKeys = paramKeys.length === WEB_VIEW_PRESENTATION_PARAM_KEYS.length
        && WEB_VIEW_PRESENTATION_PARAM_KEYS.every((key) => (
            Object.prototype.hasOwnProperty.call(params, key)
        ))
        && paramKeys.every((key) => WEB_VIEW_PRESENTATION_PARAM_KEYS.includes(key));
    if (!hasExpectedParamKeys) {
        return null;
    }

    const {
        fullScreen,
        showFloatButton,
        topSafeAreaEnabled,
        bottomSafeAreaEnabled,
        backgroundColor,
        statusBarStyle,
        screenOrientation,
    } = params;
    const hasValidBooleanValues = typeof fullScreen === 'boolean'
        && typeof showFloatButton === 'boolean'
        && typeof topSafeAreaEnabled === 'boolean'
        && typeof bottomSafeAreaEnabled === 'boolean';
    if (!hasValidBooleanValues
        || typeof backgroundColor !== 'string'
        || !ARGB_COLOR_PATTERN.test(backgroundColor)
        || !WEB_VIEW_STATUS_BAR_STYLES.has(statusBarStyle)
        || !isWebViewScreenOrientation(screenOrientation)) {
        return null;
    }

    return {
        fullScreen,
        showFloatButton,
        topSafeAreaEnabled,
        bottomSafeAreaEnabled,
        backgroundColor,
        statusBarStyle,
        screenOrientation,
    };
}
