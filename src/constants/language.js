import rawBusinessTranslations from '@/locales/business-language.json';

const BUILTIN_LANGUAGE_KEYS = ['zh', 'en'];

const transformBuiltInTranslations = (rawTranslations = {}) => {
    return BUILTIN_LANGUAGE_KEYS.reduce((accumulator, lang) => {
        accumulator[lang] = Object.entries(rawTranslations).reduce((langMap, [key, value]) => {
            const translation = typeof value?.[lang] === 'string' ? value[lang] : '';
            if (!translation) {
                return langMap;
            }

            langMap[key] = translation;
            return langMap;
        }, {});

        return accumulator;
    }, {});
};

const BUILTIN_TRANSLATIONS = transformBuiltInTranslations(rawBusinessTranslations);

export const getBuiltInTranslations = (lang = 'en') => {
    const translations = BUILTIN_TRANSLATIONS[lang];
    return translations ? { ...translations } : {};
};
