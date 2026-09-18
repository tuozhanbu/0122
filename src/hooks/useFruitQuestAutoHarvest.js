import { useEffect } from 'react';
import useFruitQuestStore from '@/store/useFruitQuestStore';
import { FRUIT_QUEST_AUTO_HARVEST_INTERVAL_MS } from '@/store/fruitQuestCatalog';

export default function useFruitQuestAutoHarvest() {
    const hasHydrated = useFruitQuestStore((state) => state.hasHydrated);
    const autoHarvestEnabled = useFruitQuestStore((state) => state.autoHarvestEnabled);
    const harvestFruitGridAutomatically = useFruitQuestStore((state) => state.harvestFruitGridAutomatically);

    useEffect(() => {
        if (!hasHydrated || !autoHarvestEnabled) {
            return undefined;
        }

        const autoHarvestTimer = setInterval(
            harvestFruitGridAutomatically,
            FRUIT_QUEST_AUTO_HARVEST_INTERVAL_MS,
        );
        return () => clearInterval(autoHarvestTimer);
    }, [autoHarvestEnabled, hasHydrated, harvestFruitGridAutomatically]);
}
