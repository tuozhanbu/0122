import rawSystemTranslations from '@/locales/system-language.json';
import rawBusinessTranslations from '@/locales/business-language.json';

export const BUILTIN_LANGUAGE_VER = 1;

const BUILTIN_LANGUAGE_KEYS = ['zh', 'en'];

const normalizeTranslation = (value) => {
    if (typeof value !== 'string') {
        return '';
    }

    return value.replace(/\r?\n/g, '').trim();
};

const transformBuiltInTranslations = (rawTranslations = {}) => {
    return BUILTIN_LANGUAGE_KEYS.reduce((accumulator, lang) => {
        accumulator[lang] = Object.entries(rawTranslations).reduce((langMap, [key, value]) => {
            const translation = normalizeTranslation(value?.[lang]);

            if (!translation) {
                return langMap;
            }

            langMap[key] = translation;
            return langMap;
        }, {});

        return accumulator;
    }, {});
};

const BUILTIN_TRANSLATIONS = transformBuiltInTranslations({
    ...rawSystemTranslations,
    ...rawBusinessTranslations,
});

export const getBuiltInTranslations = (lang = 'en') => {
    const translations = BUILTIN_TRANSLATIONS[lang];
    return translations ? { ...translations } : {};
};
