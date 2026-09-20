import { Asset } from 'expo-asset';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

let audioModeTask = null;

const ensureAudioMode = () => {
    if (!audioModeTask) {
        audioModeTask = setAudioModeAsync({
            playsInSilentMode: true,
            shouldPlayInBackground: false,
        }).catch((error) => {
            audioModeTask = null;
            throw error;
        });
    }
    return audioModeTask;
};

const loadAudioSource = async (soundAsset) => {
    const asset = Asset.fromModule(soundAsset);
    if (!asset.localUri) {
        await asset.downloadAsync();
    }
    return { uri: asset.localUri ?? asset.uri };
};

const createLoadedAudioPlayer = async (soundAsset, updateInterval) => {
    await ensureAudioMode();
    const source = await loadAudioSource(soundAsset);
    return createAudioPlayer(source, {
        updateInterval,
        keepAudioSessionActive: false,
    });
};

const resetAudioPlayer = async (player) => {
    player.pause();
    if (player.currentTime > 0) {
        await player.seekTo(0);
    }
};

export const createSoundEffectPlayback = (soundAsset) => {
    let player = null;
    let loadTask = null;
    let playRevision = 0;
    let disposed = false;

    const requireActivePlayback = () => {
        if (disposed) {
            throw new Error('Sound effect playback has been disposed');
        }
    };

    const loadPlayer = async () => {
        if (player) {
            return player;
        }
        if (!loadTask) {
            loadTask = createLoadedAudioPlayer(soundAsset, 100)
                .then((nextPlayer) => {
                    if (disposed) {
                        nextPlayer.remove();
                        return null;
                    }
                    player = nextPlayer;
                    return nextPlayer;
                })
                .finally(() => {
                    loadTask = null;
                });
        }
        return await loadTask;
    };

    const play = async () => {
        requireActivePlayback();
        const activePlayRevision = ++playRevision;
        const activePlayer = await loadPlayer();
        if (!activePlayer || disposed || activePlayRevision !== playRevision) {
            return;
        }
        await resetAudioPlayer(activePlayer);
        if (disposed || activePlayRevision !== playRevision || player !== activePlayer) {
            return;
        }
        activePlayer.play();
    };

    const stop = async () => {
        requireActivePlayback();
        playRevision += 1;
        if (player) {
            await resetAudioPlayer(player);
        }
    };

    const dispose = () => {
        if (disposed) {
            return;
        }
        disposed = true;
        playRevision += 1;
        player?.remove();
        player = null;
    };

    return { play, stop, dispose };
};

export const createLoopingAudioPlayback = (soundAsset) => {
    let player = null;
    let loadTask = null;
    let shouldPlay = false;
    let disposed = false;

    const requireActivePlayback = () => {
        if (disposed) {
            throw new Error('Looping audio playback has been disposed');
        }
    };

    const loadPlayer = async () => {
        if (player) {
            return player;
        }
        if (!loadTask) {
            loadTask = createLoadedAudioPlayer(soundAsset, 500)
                .then((nextPlayer) => {
                    nextPlayer.loop = true;
                    if (disposed) {
                        nextPlayer.remove();
                        return null;
                    }
                    player = nextPlayer;
                    return nextPlayer;
                })
                .finally(() => {
                    loadTask = null;
                });
        }
        return await loadTask;
    };

    const play = async () => {
        requireActivePlayback();
        shouldPlay = true;
        const activePlayer = await loadPlayer();
        if (!activePlayer || disposed || !shouldPlay) {
            return;
        }
        activePlayer.play();
    };

    const pause = () => {
        requireActivePlayback();
        shouldPlay = false;
        player?.pause();
    };

    const stop = async () => {
        requireActivePlayback();
        shouldPlay = false;
        if (player) {
            await resetAudioPlayer(player);
        }
    };

    const dispose = () => {
        if (disposed) {
            return;
        }
        disposed = true;
        shouldPlay = false;
        player?.remove();
        player = null;
    };

    return { play, pause, stop, dispose };
};
