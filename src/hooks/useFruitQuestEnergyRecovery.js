import { useEffect } from 'react';
import { AppState } from 'react-native';
import useFruitQuestStore from '@/store/useFruitQuestStore';

export default function useFruitQuestEnergyRecovery() {
    const hasHydrated = useFruitQuestStore((state) => state.hasHydrated);
    const refreshFruitQuestProgress = useFruitQuestStore((state) => state.refreshFruitQuestProgress);

    useEffect(() => {
        if (!hasHydrated) {
            return undefined;
        }

        refreshFruitQuestProgress();
        const appStateListener = AppState.addEventListener('change', (nextState) => {
            if (nextState === 'active') {
                refreshFruitQuestProgress();
            }
        });
        const energyRecoveryTimer = setInterval(refreshFruitQuestProgress, 1000);

        return () => {
            appStateListener.remove();
            clearInterval(energyRecoveryTimer);
        };
    }, [hasHydrated, refreshFruitQuestProgress]);
}
