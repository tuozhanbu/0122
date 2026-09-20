import { Stack } from 'expo-router';
import FruitQuestAudioProvider from '@/components/fruitQuest/FruitQuestAudioProvider';
import useFruitQuestAutoHarvest from '@/hooks/useFruitQuestAutoHarvest';
import useFruitQuestEnergyRecovery from '@/hooks/useFruitQuestEnergyRecovery';

export default function FruitQuestLayout() {
    useFruitQuestEnergyRecovery();
    useFruitQuestAutoHarvest();

    return (
        <FruitQuestAudioProvider>
            <Stack
                screenOptions={{
                    headerShown: false,
                    animation: 'none',
                }}
            />
        </FruitQuestAudioProvider>
    );
}
