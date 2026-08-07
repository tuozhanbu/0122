import { create } from 'zustand';

const useWebViewAuthStore = create((set) => ({
    googleAuthResultUrl: null,
    setGoogleAuthResultUrl: (googleAuthResultUrl) => set({ googleAuthResultUrl }),
    clearGoogleAuthResultUrl: () => set({ googleAuthResultUrl: null }),

    telegramAuthResultUrl: null,
    setTelegramAuthResultUrl: (telegramAuthResultUrl) => set({ telegramAuthResultUrl }),
    clearTelegramAuthResultUrl: () => set({ telegramAuthResultUrl: null }),

    clearWebViewAuthRuntimeState: () => set({
        googleAuthResultUrl: null,
        telegramAuthResultUrl: null,
    }),
}));

export default useWebViewAuthStore;
