import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
} from 'react';
import useFruitQuestStore from '@/store/useFruitQuestStore';
import { createFruitQuestAudioPlayback } from '@/services/fruitQuestAudio';

const FruitQuestAudioContext = createContext(null);

export const useFruitQuestAudio = () => {
    const audio = useContext(FruitQuestAudioContext);
    if (!audio) {
        throw new Error('Fruit Quest audio is unavailable outside FruitQuestAudioProvider');
    }
    return audio;
};

export default function FruitQuestAudioProvider({ children }) {
    const hasHydrated = useFruitQuestStore((state) => state.hasHydrated);
    const backgroundMusicEnabled = useFruitQuestStore((state) => state.backgroundMusicEnabled);
    const soundEffectsEnabled = useFruitQuestStore((state) => state.soundEffectsEnabled);
    const audioPlaybackRef = useRef(null);

    useEffect(() => {
        const audioPlayback = createFruitQuestAudioPlayback();
        audioPlaybackRef.current = audioPlayback;

        return () => {
            audioPlayback.pauseBackgroundMusic();
            audioPlayback.dispose();
            if (audioPlaybackRef.current === audioPlayback) {
                audioPlaybackRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (!hasHydrated) {
            return;
        }
        if (backgroundMusicEnabled) {
            audioPlaybackRef.current?.startBackgroundMusic();
            return;
        }
        audioPlaybackRef.current?.pauseBackgroundMusic();
    }, [backgroundMusicEnabled, hasHydrated]);

    const playButtonPress = useCallback(() => {
        if (soundEffectsEnabled) {
            audioPlaybackRef.current?.playButtonPress();
        }
    }, [soundEffectsEnabled]);

    const playHarvest = useCallback(() => {
        if (soundEffectsEnabled) {
            audioPlaybackRef.current?.playHarvest();
        }
    }, [soundEffectsEnabled]);

    const playSpin = useCallback(() => {
        if (soundEffectsEnabled) {
            audioPlaybackRef.current?.playSpin();
        }
    }, [soundEffectsEnabled]);

    const playInsufficientEnergy = useCallback(() => {
        if (soundEffectsEnabled) {
            audioPlaybackRef.current?.playInsufficientEnergy();
        }
    }, [soundEffectsEnabled]);

    const playOrderClaimed = useCallback(() => {
        if (soundEffectsEnabled) {
            audioPlaybackRef.current?.playOrderClaimed();
        }
    }, [soundEffectsEnabled]);

    const audio = useMemo(() => ({
        playButtonPress,
        playHarvest,
        playSpin,
        playInsufficientEnergy,
        playOrderClaimed,
    }), [playButtonPress, playHarvest, playSpin, playInsufficientEnergy, playOrderClaimed]);

    return (
        <FruitQuestAudioContext.Provider value={audio}>
            {children}
        </FruitQuestAudioContext.Provider>
    );
}
