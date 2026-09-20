import useLangStore from '@/store/useLangStore';

export default function useTranslation() {
    const lang = useLangStore((state) => state.lang);
    const translations = useLangStore((state) => state.translations);

    const t = (key, params) => {
        const text = translations[key] ?? key;
        if (!params || typeof text !== 'string') {
            return text;
        }

        return Object.entries(params).reduce((result, [name, value]) => {
            return result.replace(new RegExp(`\\{${name}\\}`, 'g'), String(value));
        }, text);
    };

    return { lang, translations, t };
}
