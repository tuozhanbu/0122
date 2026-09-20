import {
    createLoopingAudioPlayback,
    createSoundEffectPlayback,
} from '@/services/audioPlayback';
import { createLogger } from '@/utils/logger';

const logger = createLogger('FruitQuestAudio');

const FRUIT_QUEST_AUDIO_ASSETS = Object.freeze({
    backgroundMusic: require('@/assets/fruit-quest/audio/fruit-quest-background.mp3'),
    buttonPress: require('@/assets/fruit-quest/audio/fruit-quest-button-press.mp3'),
    harvest: require('@/assets/fruit-quest/audio/fruit-quest-harvest.mp3'),
    spin: require('@/assets/fruit-quest/audio/fruit-quest-spin.mp3'),
    insufficientEnergy: require('@/assets/fruit-quest/audio/insufficient-energy.mp3'),
    orderClaimed: require('@/assets/fruit-quest/audio/order-claimed.mp3'),
});

const playSoundEffect = (soundEffect) => {
    soundEffect.play().catch((error) => {
        logger.warn('sound effect playback failed', { error });
    });
};

const startBackgroundMusic = (backgroundMusicPlayback) => {
    backgroundMusicPlayback.play().catch((error) => {
        logger.warn('background music playback failed', { error });
    });
};

export const createFruitQuestAudioPlayback = () => {
    const backgroundMusicPlayback = createLoopingAudioPlayback(FRUIT_QUEST_AUDIO_ASSETS.backgroundMusic);
    const buttonPressPlayback = createSoundEffectPlayback(FRUIT_QUEST_AUDIO_ASSETS.buttonPress);
    const harvestPlayback = createSoundEffectPlayback(FRUIT_QUEST_AUDIO_ASSETS.harvest);
    const spinPlayback = createSoundEffectPlayback(FRUIT_QUEST_AUDIO_ASSETS.spin);
    const insufficientEnergyPlayback = createSoundEffectPlayback(FRUIT_QUEST_AUDIO_ASSETS.insufficientEnergy);
    const orderClaimedPlayback = createSoundEffectPlayback(FRUIT_QUEST_AUDIO_ASSETS.orderClaimed);

    return {
        startBackgroundMusic: () => startBackgroundMusic(backgroundMusicPlayback),
        pauseBackgroundMusic: () => backgroundMusicPlayback.pause(),
        playButtonPress: () => playSoundEffect(buttonPressPlayback),
        playHarvest: () => playSoundEffect(harvestPlayback),
        playSpin: () => playSoundEffect(spinPlayback),
        playInsufficientEnergy: () => playSoundEffect(insufficientEnergyPlayback),
        playOrderClaimed: () => playSoundEffect(orderClaimedPlayback),
        dispose: () => {
            backgroundMusicPlayback.dispose();
            buttonPressPlayback.dispose();
            harvestPlayback.dispose();
            spinPlayback.dispose();
            insufficientEnergyPlayback.dispose();
            orderClaimedPlayback.dispose();
        },
    };
};
