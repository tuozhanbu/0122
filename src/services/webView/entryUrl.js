// X* 控制参数的 key 列表
const ROUTE_PARAM_KEYS = [
    'XFullScreen',
    'XShowFloatButton',
    'XSafeBottom',
    'XSafeTop',
    'XBackgroundColor',
    'XStatusBarStyle',
    'XScreenOrientation',
    'XSafeBottomStatus',
    'XSafeTopStatus',
];

// 默认值
const DEFAULT_ROUTE_PARAMS = {
    XFullScreen: '1',
    XShowFloatButton: '0',
    XSafeBottom: '0',
    XSafeTop: '1',
    XBackgroundColor: '0xFF000000',
    // 'auto'  -> 根据 XBackgroundColor 亮度自动选择（默认）
    // 'dark'  -> 强制深色图标（适合浅色背景，如白色）
    // 'light' -> 强制白色图标（适合深色背景）
    XStatusBarStyle: 'auto',
    XScreenOrientation: 'auto',
    XSafeBottomStatus: '0',
    XSafeTopStatus: '0',
};

const decodeRouteUrl = (rawUrl) => {
    const url = String(rawUrl ?? '');
    try {
        return decodeURIComponent(url);
    } catch {
        return url;
    }
};

/**
 * 从 URL 中提取 X* 控制参数，并返回剥离这些参数后的干净 URL。
 * expo-router 会把内层 URL 中未编码的 `&` 拆成顶层 route params，所以这里也合并 route-level X* 参数。
 */
export function extractEntryConfig(rawUrl, routeParams = {}) {
    const decodedUrl = decodeRouteUrl(rawUrl);
    try {
        const parsed = new URL(decodedUrl);
        const xParams = { ...DEFAULT_ROUTE_PARAMS };
        ROUTE_PARAM_KEYS.forEach((key) => {
            if (parsed.searchParams.has(key)) {
                xParams[key] = parsed.searchParams.get(key);
                parsed.searchParams.delete(key);
            }
            // Merge any X* params that expo-router placed at route level
            if (routeParams[key] !== undefined) {
                xParams[key] = String(routeParams[key]);
            }
        });
        return { cleanUrl: parsed.toString(), xParams };
    } catch {
        const xParams = { ...DEFAULT_ROUTE_PARAMS };
        ROUTE_PARAM_KEYS.forEach((key) => {
            if (routeParams[key] !== undefined) {
                xParams[key] = String(routeParams[key]);
            }
        });
        return { cleanUrl: decodedUrl, xParams };
    }
}

export function buildEntryUrl(cleanUrl, safeTopStatus, safeBottomStatus, safeTop, safeBottom) {
    try {
        const parsed = new URL(cleanUrl);
        if (safeTopStatus === '1') {
            parsed.searchParams.set('safeTop', String(safeTop));
        }
        if (safeBottomStatus === '1') {
            parsed.searchParams.set('safeBottom', String(safeBottom));
        }
        return parsed.toString();
    } catch {
        return cleanUrl;
    }
}

export function resolveChromeStyle(backgroundColorValue, statusBarStyle) {
    try {
        // 将 ARGB 16进制（0xAARRGGBB）转为 rgba(r,g,b,a) 字符串，并计算状态栏样式
        const numberValue = parseInt(String(backgroundColorValue ?? '').replace('0x', ''), 16);
        const alpha = ((numberValue >>> 24) & 0xff) / 255;
        const red = (numberValue >>> 16) & 0xff;
        const green = (numberValue >>> 8) & 0xff;
        const blue = numberValue & 0xff;
        const backgroundColor = `rgba(${red},${green},${blue},${alpha.toFixed(2)})`;

        if (statusBarStyle === 'dark') {
            return { backgroundColor, barStyle: 'dark-content' };
        }
        if (statusBarStyle === 'light') {
            return { backgroundColor, barStyle: 'light-content' };
        }

        // 根据背景色亮度自动选择状态栏图标颜色
        // 公式：感知亮度 = 0.299R + 0.587G + 0.114B（ITU-R BT.601）
        // auto：亮度 > 128 为浅色背景 → 深色图标，否则白色图标
        const luminance = 0.299 * red + 0.587 * green + 0.114 * blue;
        return {
            backgroundColor,
            barStyle: luminance > 128 ? 'dark-content' : 'light-content',
        };
    } catch {
        return { backgroundColor: 'transparent', barStyle: 'dark-content' };
    }
}
