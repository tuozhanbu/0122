import { create } from 'zustand';
import {
    setLanguage,
    getLanguage,
    tryRemoveItem,
} from '@/utils/storage';
import { APP_STORAGE_KEYS } from '@/constants/storageKeys';
import {
    BUILTIN_LANGUAGE_VER,
    getBuiltInTranslations,
} from '@/constants/language';

const LANG_RUNTIME_STATE_KEY = '__APP_LANG_RUNTIME_STATE__';
const LANG_RUNTIME_UNSUBSCRIBE_KEY = '__APP_LANG_RUNTIME_UNSUBSCRIBE__';

const getBuiltInLangState = (lang) => ({
    languageVer: BUILTIN_LANGUAGE_VER,
    translations: getBuiltInTranslations(lang),
});

const defaultLangRuntimeState = {
    // 当前语言，默认 'en'
    lang: 'en',

    // 翻译表 { '中文原文': '目标语言翻译', ... }
    translations: {},

    languageVer: 0,

    // init 接口返回的最新语言版本
    serverLanguageVer: 0,

    // 后端返回的支持语言列表 { en: 'English', zh: '简体中文' }
    supportedLangs: {},
};

const readInitialLangRuntimeState = () => {
    if (!__DEV__) {
        return defaultLangRuntimeState;
    }

    const runtimeState = globalThis[LANG_RUNTIME_STATE_KEY];
    if (!runtimeState || typeof runtimeState !== 'object' || Array.isArray(runtimeState)) {
        return defaultLangRuntimeState;
    }

    return {
        ...defaultLangRuntimeState,
        ...runtimeState,
    };
};

const pickLangRuntimeState = (state) => ({
    lang: state.lang,
    translations: state.translations,
    languageVer: state.languageVer,
    serverLanguageVer: state.serverLanguageVer,
    supportedLangs: state.supportedLangs,
});

const useLangStore = create((set) => ({
    ...readInitialLangRuntimeState(),

    /** App 启动时恢复语言偏好并加载项目内置文案。 */
    initLang: async () => {
        const lang = await getLanguage();
        set({ lang, ...getBuiltInLangState(lang) });
    },

    clearLangRuntimeState: () => {
        set({
            lang: defaultLangRuntimeState.lang,
            translations: {},
            languageVer: 0,
            serverLanguageVer: 0,
            supportedLangs: {},
        });
    },

    /** 手动切换项目内置语言。 */
    switchLang: async (lang) => {
        await setLanguage(lang);
        set({ lang, ...getBuiltInLangState(lang) });
    },

    resetLang: async () => {
        await tryRemoveItem(APP_STORAGE_KEYS.language.current);
        set({
            lang: 'en',
            ...getBuiltInLangState('en'),
        });
    },

}));

if (__DEV__) {
    if (typeof globalThis[LANG_RUNTIME_UNSUBSCRIBE_KEY] === 'function') {
        globalThis[LANG_RUNTIME_UNSUBSCRIBE_KEY]();
    }
    globalThis[LANG_RUNTIME_STATE_KEY] = pickLangRuntimeState(useLangStore.getState());
    globalThis[LANG_RUNTIME_UNSUBSCRIBE_KEY] = useLangStore.subscribe((state) => {
        globalThis[LANG_RUNTIME_STATE_KEY] = pickLangRuntimeState(state);
    });
}

export default useLangStore;
