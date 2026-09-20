import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
    FRUIT_QUEST_ENERGY_BOOST_AMOUNT,
    FRUIT_QUEST_ENERGY_BOOST_COOLDOWN_MS,
    FRUIT_QUEST_ENERGY_LIMIT,
    FRUIT_QUEST_ENERGY_RECOVERY_INTERVAL_MS,
    FRUIT_QUEST_HARVEST_ENERGY_COST,
    FRUIT_QUEST_INITIAL_GARDEN_GRID,
    createFruitQuestDailyOrderFruitIds,
    createFruitQuestHarvestFruitIds,
} from '@/store/fruitQuestCatalog';

const FRUIT_QUEST_STORAGE_KEY = 'fruitQuest.progress';
const FRUIT_QUEST_PROGRESS_STORAGE_VERSION = 3;

const getFruitQuestLocalDateKey = (currentTime) => {
    const date = new Date(currentTime);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const createFruitQuestDailyOrders = (dateKey) => {
    const [firstFruitId, secondFruitId] = createFruitQuestDailyOrderFruitIds(dateKey);
    return Object.fromEntries([firstFruitId, secondFruitId].map((fruitId) => [fruitId, {
        id: fruitId,
        fruitId,
        requiredCount: 10,
        submittedCount: 0,
        experienceReward: 50,
        claimed: false,
    }]));
};

const createInitialFruitQuestProgress = () => {
    const currentTime = Date.now();
    const dailyOrderDate = getFruitQuestLocalDateKey(currentTime);

    return {
        energy: FRUIT_QUEST_ENERGY_LIMIT,
        lastRecoveryAt: currentTime,
        experience: 0,
        fruitQuantities: {
            apple: 1,
            banana: 2,
            watermelon: 1,
            kiwi: 1,
            'rainbow-strawberry': 2,
            'golden-apple': 1,
        },
        dailyOrderDate,
        fruitOrders: createFruitQuestDailyOrders(dailyOrderDate),
        gardenFruitIds: FRUIT_QUEST_INITIAL_GARDEN_GRID,
        energyBoostAvailableAt: 0,
        autoHarvestEnabled: false,
        backgroundMusicEnabled: true,
        soundEffectsEnabled: true,
        unseenFruitIds: [],
    };
};

const getRecoveredEnergy = (energy, lastRecoveryAt, currentTime) => {
    if (energy >= FRUIT_QUEST_ENERGY_LIMIT) {
        return {
            energy: FRUIT_QUEST_ENERGY_LIMIT,
            lastRecoveryAt: currentTime,
        };
    }

    const elapsedMs = currentTime - lastRecoveryAt;
    const recoveredEnergy = Math.floor(elapsedMs / FRUIT_QUEST_ENERGY_RECOVERY_INTERVAL_MS);
    if (recoveredEnergy <= 0) {
        return { energy, lastRecoveryAt };
    }

    const nextEnergy = Math.min(FRUIT_QUEST_ENERGY_LIMIT, energy + recoveredEnergy);
    return {
        energy: nextEnergy,
        lastRecoveryAt: nextEnergy === FRUIT_QUEST_ENERGY_LIMIT
            ? currentTime
            : lastRecoveryAt + recoveredEnergy * FRUIT_QUEST_ENERGY_RECOVERY_INTERVAL_MS,
    };
};

const createCurrentFruitQuestProgressUpdate = (state, currentTime) => {
    const dailyOrderDate = getFruitQuestLocalDateKey(currentTime);
    return {
        ...getRecoveredEnergy(state.energy, state.lastRecoveryAt, currentTime),
        dailyOrderDate,
        fruitOrders: state.dailyOrderDate === dailyOrderDate
            ? state.fruitOrders
            : createFruitQuestDailyOrders(dailyOrderDate),
    };
};

const addFruitOrderProgress = (orders, harvestedFruitIds) => {
    return Object.fromEntries(Object.entries(orders).map(([orderId, order]) => {
        if (order.claimed) {
            return [orderId, order];
        }

        const harvestedCount = harvestedFruitIds.filter((fruitId) => fruitId === order.fruitId).length;
        return [orderId, {
            ...order,
            submittedCount: Math.min(order.requiredCount, order.submittedCount + harvestedCount),
        }];
    }));
};

const addHarvestedFruitQuantities = (fruitQuantities, harvestedFruitIds) => {
    return harvestedFruitIds.reduce((nextFruitQuantities, fruitId) => ({
        ...nextFruitQuantities,
        [fruitId]: (nextFruitQuantities[fruitId] ?? 0) + 1,
    }), { ...fruitQuantities });
};

const getNewFruitIds = (fruitQuantities, harvestedFruitIds) => {
    return harvestedFruitIds.reduce((newFruitIds, fruitId) => {
        if (fruitQuantities[fruitId] > 0 || newFruitIds.includes(fruitId)) {
            return newFruitIds;
        }
        return [...newFruitIds, fruitId];
    }, []);
};

const migrateFruitQuestProgress = (persistedProgress, persistedVersion) => {
    const storedVersion = Number.isInteger(persistedVersion) ? persistedVersion : 0;
    let migratedProgress = persistedProgress;

    if (storedVersion < 1) {
        const fruitQuantities = Object.fromEntries(
            Object.entries(migratedProgress.fruitQuantities).filter(([fruitId]) => fruitId !== 'lemon'),
        );
        migratedProgress = {
            ...migratedProgress,
            fruitQuantities,
        };
    }

    if (storedVersion < 2) {
        const dailyOrderDate = getFruitQuestLocalDateKey(Date.now());
        migratedProgress = {
            ...migratedProgress,
            dailyOrderDate,
            fruitOrders: createFruitQuestDailyOrders(dailyOrderDate),
            energyBoostAvailableAt: 0,
            autoHarvestEnabled: false,
            backgroundMusicEnabled: true,
            soundEffectsEnabled: true,
        };
    }

    if (storedVersion < FRUIT_QUEST_PROGRESS_STORAGE_VERSION) {
        return {
            ...migratedProgress,
            unseenFruitIds: [],
        };
    }

    return migratedProgress;
};

/**
 * 游戏进度属于可恢复的本地体验状态。存储失败不改变内存中的本次进度，下一次启动可重新开始保存。
 */
const fruitQuestProgressStorage = {
    getItem: async (key) => {
        try {
            return await AsyncStorage.getItem(key);
        } catch {
            return null;
        }
    },
    setItem: async (key, value) => {
        try {
            await AsyncStorage.setItem(key, value);
        } catch {
            // 本地进度写入失败不应打断当前游戏。
        }
    },
    removeItem: async (key) => {
        try {
            await AsyncStorage.removeItem(key);
        } catch {
            // 本地进度删除失败不应打断当前游戏。
        }
    },
};

const useFruitQuestStore = create(persist((set, get) => ({
    hasHydrated: false,
    ...createInitialFruitQuestProgress(),

    markFruitQuestProgressHydrated: () => set({ hasHydrated: true }),

    refreshFruitQuestProgress: () => {
        const currentTime = Date.now();
        set((state) => createCurrentFruitQuestProgressUpdate(state, currentTime));
    },

    harvestFruitGrid: () => {
        const currentTime = Date.now();
        let harvestResult = { status: 'insufficient_energy' };

        set((state) => {
            const currentProgress = createCurrentFruitQuestProgressUpdate(state, currentTime);
            if (currentProgress.energy < FRUIT_QUEST_HARVEST_ENERGY_COST) {
                return currentProgress;
            }

            const harvestedFruitIds = createFruitQuestHarvestFruitIds();
            const newFruitIds = getNewFruitIds(state.fruitQuantities, harvestedFruitIds);
            harvestResult = {
                status: 'harvested',
                fruitIds: harvestedFruitIds,
            };

            return {
                ...currentProgress,
                energy: currentProgress.energy - FRUIT_QUEST_HARVEST_ENERGY_COST,
                lastRecoveryAt: currentTime,
                fruitQuantities: addHarvestedFruitQuantities(state.fruitQuantities, harvestedFruitIds),
                fruitOrders: addFruitOrderProgress(currentProgress.fruitOrders, harvestedFruitIds),
                gardenFruitIds: harvestedFruitIds,
                unseenFruitIds: [...state.unseenFruitIds, ...newFruitIds],
            };
        });

        return harvestResult;
    },

    harvestFruitGridAutomatically: () => {
        if (!get().autoHarvestEnabled) {
            return { status: 'auto_harvest_disabled' };
        }
        return get().harvestFruitGrid();
    },

    accelerateEnergyRecovery: () => {
        const currentTime = Date.now();
        let energyBoostResult = { status: 'energy_full' };

        set((state) => {
            const currentProgress = createCurrentFruitQuestProgressUpdate(state, currentTime);
            if (currentProgress.energy === FRUIT_QUEST_ENERGY_LIMIT) {
                return currentProgress;
            }
            if (state.energyBoostAvailableAt > currentTime) {
                energyBoostResult = {
                    status: 'cooling_down',
                    remainingMs: state.energyBoostAvailableAt - currentTime,
                };
                return currentProgress;
            }

            const restoredEnergy = Math.min(
                FRUIT_QUEST_ENERGY_BOOST_AMOUNT,
                FRUIT_QUEST_ENERGY_LIMIT - currentProgress.energy,
            );
            energyBoostResult = { status: 'accelerated', restoredEnergy };
            return {
                ...currentProgress,
                energy: currentProgress.energy + restoredEnergy,
                energyBoostAvailableAt: currentTime + FRUIT_QUEST_ENERGY_BOOST_COOLDOWN_MS,
            };
        });

        return energyBoostResult;
    },

    claimFruitOrder: (orderId) => {
        const currentTime = Date.now();
        let claimResult = { status: 'order_refreshed' };

        set((state) => {
            const currentProgress = createCurrentFruitQuestProgressUpdate(state, currentTime);
            const order = currentProgress.fruitOrders[orderId];
            if (!order) {
                return currentProgress;
            }
            if (order.claimed) {
                claimResult = { status: 'already_claimed' };
                return currentProgress;
            }
            if (order.submittedCount < order.requiredCount) {
                claimResult = { status: 'incomplete' };
                return currentProgress;
            }

            claimResult = { status: 'claimed' };
            return {
                ...currentProgress,
                experience: state.experience + order.experienceReward,
                fruitOrders: {
                    ...currentProgress.fruitOrders,
                    [orderId]: {
                        ...order,
                        claimed: true,
                    },
                },
            };
        });

        return claimResult;
    },

    enableAutoHarvest: () => set({ autoHarvestEnabled: true }),
    disableAutoHarvest: () => set({ autoHarvestEnabled: false }),
    enableBackgroundMusic: () => set({ backgroundMusicEnabled: true }),
    disableBackgroundMusic: () => set({ backgroundMusicEnabled: false }),
    enableSoundEffects: () => set({ soundEffectsEnabled: true }),
    disableSoundEffects: () => set({ soundEffectsEnabled: false }),
    markFruitDiscoveriesSeen: () => set({ unseenFruitIds: [] }),
}), {
    name: FRUIT_QUEST_STORAGE_KEY,
    version: FRUIT_QUEST_PROGRESS_STORAGE_VERSION,
    migrate: migrateFruitQuestProgress,
    storage: createJSONStorage(() => fruitQuestProgressStorage),
    partialize: (state) => ({
        energy: state.energy,
        lastRecoveryAt: state.lastRecoveryAt,
        experience: state.experience,
        fruitQuantities: state.fruitQuantities,
        dailyOrderDate: state.dailyOrderDate,
        fruitOrders: state.fruitOrders,
        gardenFruitIds: state.gardenFruitIds,
        energyBoostAvailableAt: state.energyBoostAvailableAt,
        autoHarvestEnabled: state.autoHarvestEnabled,
        backgroundMusicEnabled: state.backgroundMusicEnabled,
        soundEffectsEnabled: state.soundEffectsEnabled,
        unseenFruitIds: state.unseenFruitIds,
    }),
    onRehydrateStorage: () => (state) => {
        if (state) {
            state.markFruitQuestProgressHydrated();
        }
    },
}));

export default useFruitQuestStore;
