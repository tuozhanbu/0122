/**
 * 主题常量 - 颜色、字体、间距等设计 Token
 */

export const Colors = {
    // 主色调
    primary: '#4F6EF7',
    primaryLight: '#7B93FF',
    primaryDark: '#3350D9',

    // 辅助色
    secondary: '#FF6B6B',
    success: '#00C48C',
    warning: '#FFAA00',
    error: '#FF4D4F',
    info: '#1890FF',

    // 中性色
    white: '#FFFFFF',
    black: '#000000',
    background: '#F5F7FA',
    surface: '#FFFFFF',

    // 文字色
    textPrimary: '#1A1A2E',
    textSecondary: '#666687',
    textDisabled: '#A5A5BA',
    textHint: '#C0C0D0',

    // 分割线
    border: '#E8E8F0',
    divider: '#F0F0F8',

    // 透明
    transparent: 'transparent',
    overlay: 'rgba(0, 0, 0, 0.5)',
};

export const FontSize = {
    xs: 10,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 18,
    '2xl': 20,
    '3xl': 24,
    '4xl': 30,
    '5xl': 36,
};

export const FontWeight = {
    light: '300',
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
};

export const Spacing = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    '2xl': 24,
    '3xl': 32,
    '4xl': 40,
    '5xl': 48,
};

export const BorderRadius = {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    '2xl': 24,
    full: 9999,
};

export const Shadow = {
    sm: {
        boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.05)',
    },
    md: {
        boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.08)',
    },
    lg: {
        boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.12)',
    },
};

export default { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadow };
