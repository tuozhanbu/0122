import { create } from 'zustand';
import { getUserInfo, setUserInfo, removeToken, removeUserInfo } from '@/utils/storage';

/**
 * 用户状态管理 Store
 */
const useUserStore = create((set, get) => ({
    // State
    userInfo: null,
    isLoggedIn: false,
    isLoading: false,

    // Actions

    /** 初始化 - 从本地存储恢复用户信息 */
    initUser: async () => {
        set({ isLoading: true });
        const userInfo = await getUserInfo();
        set({
            userInfo,
            isLoggedIn: !!userInfo,
            isLoading: false,
        });
    },

    /** 清空当前进程中恢复的用户状态；持久化数据由所属清理操作统一删除。 */
    clearUserRuntimeState: () => {
        set({
            userInfo: null,
            isLoggedIn: false,
            isLoading: false,
        });
    },

    /** 设置用户信息（登录成功后调用） */
    setUser: async (userInfo) => {
        await setUserInfo(userInfo);
        set({ userInfo, isLoggedIn: true });
    },

    /** 更新用户信息部分字段 */
    updateUser: async (partial) => {
        const current = get().userInfo;
        const updated = { ...current, ...partial };
        await setUserInfo(updated);
        set({ userInfo: updated });
    },

    /** 登出 */
    logout: async () => {
        await removeToken();
        await removeUserInfo();
        set({ userInfo: null, isLoggedIn: false });
    },
}));

export default useUserStore;
