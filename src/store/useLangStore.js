import { create } from 'zustand';
import {
    setLanguage,
    getLanguage,
    getRawLanguage,
    getLangCache,
    setLangCache,
    tryRemoveItem,
} from '@/utils/storage';
import { systemApi } from '@/services/api/system';
import { APP_STORAGE_KEYS } from '@/constants/storageKeys';
import { BUILTIN_LANGUAGE_VER, getBuiltInTranslations } from '@/constants/language';
import { createLogger } from '@/utils/logger';

const logger = createLogger('LangStore');
const LANG_RUNTIME_STATE_KEY = '__APP_LANG_RUNTIME_STATE__';
const LANG_RUNTIME_UNSUBSCRIBE_KEY = '__APP_LANG_RUNTIME_UNSUBSCRIBE__';

const hasTranslations = (translations) => Object.keys(translations || {}).length > 0;

const getBuiltInLangState = (lang) => ({
    languageVer: BUILTIN_LANGUAGE_VER,
    translations: getBuiltInTranslations(lang),
});

const defaultLangRuntimeState = {
    // 当前语言，默认 'en'
    lang: 'en',

    // 翻译表 { '中文原文': '目标语言翻译', ... }
    translations: {},

    // 本地已缓存的翻译版本号
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

/**
 * 语言状态管理 Store
 *
 * 用法：
 *   const { lang, switchLang } = useLangStore();
 *   switchLang('zh'); // 切换语言，按语言版本决定使用内置包或远端缓存
 */
const useLangStore = create((set, get) => ({
    ...readInitialLangRuntimeState(),

    /** App 启动时从本地恢复语言设置、翻译表、版本号，返回是否有本地保存的语言 */
    initLang: async () => {
        const lang = await getLanguage();
        const { ver, translations } = await getLangCache(lang, true);
        set({ lang, languageVer: ver, translations });
    },

    /** 清空当前进程中恢复的语言状态；持久化数据由所属清理操作统一删除。 */
    clearLangRuntimeState: () => {
        set({
            lang: defaultLangRuntimeState.lang,
            translations: {},
            languageVer: 0,
            serverLanguageVer: 0,
            supportedLangs: {},
        });
    },

    /**
     * 按服务端版本号决定是否拉取新翻译
     * @param {number} serverVer      - init 接口返回的 languageVer
     * @param {object} supportedLangs - init 接口返回的 language { en: 'English', ... }
     * @param {string} defaultLanguage - init 接口返回的 defaultLanguage
     */
    fetchTranslationsIfNeeded: async (serverVer, supportedLangs, defaultLanguage) => {
        const newSupportedLangs = supportedLangs || {};
        const normalizedServerVer = Number(serverVer) > 0 ? Number(serverVer) : 0;
        set({ supportedLangs: newSupportedLangs, serverLanguageVer: normalizedServerVer });

        // 若本地从未保存过语言偏好，使用服务端 defaultLanguage
        const savedRaw = await getRawLanguage();
        let activeLang = await getLanguage();
        if (savedRaw === null && defaultLanguage) {
            await setLanguage(defaultLanguage);
            activeLang = defaultLanguage;
        }

        if (normalizedServerVer <= BUILTIN_LANGUAGE_VER) {
            const builtInState = getBuiltInLangState(activeLang);
            await setLangCache(activeLang, builtInState.languageVer, builtInState.translations);
            set({ lang: activeLang, ...builtInState });
            return;
        }

        const { ver: cachedVer, translations: cachedTranslations } = await getLangCache(activeLang, true);
        const builtInState = getBuiltInLangState(activeLang);
        const fallbackTranslations = hasTranslations(cachedTranslations)
            ? cachedTranslations
            : builtInState.translations;
        const fallbackVer = cachedVer > 0 ? cachedVer : builtInState.languageVer;

        if (cachedVer <= 0 && hasTranslations(builtInState.translations)) {
            await setLangCache(activeLang, builtInState.languageVer, builtInState.translations);
        }

        set({ lang: activeLang, languageVer: fallbackVer, translations: fallbackTranslations });

        if (normalizedServerVer > fallbackVer) {
            try {
                const res = await systemApi.getTranslations();
                const t = res?.data?.language || {};
                const newVer = res?.data?.language_ver ?? normalizedServerVer;
                await setLangCache(activeLang, newVer, t);
                if (get().lang === activeLang) {
                    set({ translations: t, languageVer: newVer });
                }
            } catch (e) {
                logger.warn('fetchTranslations failed, fallback cache used', {
                    lang: activeLang,
                    serverVer: normalizedServerVer,
                    fallbackVer,
                    error: e,
                });
            }
        }
    },

    /** 手动切换语言，低版本走内置包，高版本按缓存版本决定是否拉取 */
    switchLang: async (lang) => {
        const serverLanguageVer = get().serverLanguageVer;
        const { ver, translations } = await getLangCache(lang);
        const builtInState = getBuiltInLangState(lang);
        await setLanguage(lang);

        if (serverLanguageVer <= BUILTIN_LANGUAGE_VER) {
            await setLangCache(lang, builtInState.languageVer, builtInState.translations);
            set({ lang, ...builtInState });
            return;
        }

        const nextTranslations = hasTranslations(translations) ? translations : builtInState.translations;
        const nextVer = ver > 0 ? ver : builtInState.languageVer;

        if (ver <= 0 && hasTranslations(builtInState.translations)) {
            await setLangCache(lang, builtInState.languageVer, builtInState.translations);
        }

        set({ lang, translations: nextTranslations, languageVer: nextVer });

        if (serverLanguageVer <= nextVer) {
            return;
        }

        try {
            const res = await systemApi.getTranslations();
            const t = res?.data?.language || {};
            const newVer = res?.data?.language_ver ?? serverLanguageVer;
            await setLangCache(lang, newVer, t);
            set({ translations: t, languageVer: newVer });
        } catch (e) {
            logger.warn('switchLang fetch failed, fallback cache used', {
                lang,
                serverVer: serverLanguageVer,
                fallbackVer: nextVer,
                error: e,
            });
        }
    },

    /** 清除本地语言偏好和翻译缓存，并恢复到内置默认语言 */
    resetLang: async () => {
        await Promise.all([
            tryRemoveItem(APP_STORAGE_KEYS.language.current),
            tryRemoveItem(APP_STORAGE_KEYS.language.version),
            tryRemoveItem(APP_STORAGE_KEYS.language.translations),
            tryRemoveItem(APP_STORAGE_KEYS.language.versionCache),
            tryRemoveItem(APP_STORAGE_KEYS.language.translationsCache),
        ]);
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
