import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getBuiltInTranslations } from '@/constants/language';

const LANGUAGE_STORAGE_KEY = 'fruitQuest.language';
const DEFAULT_LANG = 'en';

const isSupportedLang = (lang) => lang === 'zh' || lang === 'en';

const useLangStore = create((set) => ({
    lang: DEFAULT_LANG,
    translations: getBuiltInTranslations(DEFAULT_LANG),

    initLang: async () => {
        try {
            const storedLang = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
            const lang = isSupportedLang(storedLang) ? storedLang : DEFAULT_LANG;
            set({ lang, translations: getBuiltInTranslations(lang) });
        } catch {
            set({
                lang: DEFAULT_LANG,
                translations: getBuiltInTranslations(DEFAULT_LANG),
            });
        }
    },

    switchLang: async (lang) => {
        if (!isSupportedLang(lang)) {
            return;
        }

        set({ lang, translations: getBuiltInTranslations(lang) });
        try {
            await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
        } catch {
            // 本地持久化失败默认吞掉
        }
    },
}));

export default useLangStore;
