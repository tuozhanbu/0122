import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from '@/components/common/Toast';
import FruitQuestFruitImage from '@/components/fruitQuest/FruitQuestFruitImage';
import { useFruitQuestAudio } from '@/components/fruitQuest/FruitQuestAudioProvider';
import FruitQuestPageFrame from '@/components/fruitQuest/FruitQuestPageFrame';
import useTranslation from '@/hooks/useTranslation';
import useFruitQuestPageLayout from '@/hooks/useFruitQuestPageLayout';
import useFruitQuestStore from '@/store/useFruitQuestStore';
import {
    FRUIT_QUEST_CATALOG,
    FRUIT_QUEST_HARVEST_ENERGY_COST,
} from '@/store/fruitQuestCatalog';
import RocketIcon from '@/assets/fruit-quest/common/icons/rocket.svg';
import AutoHarvestIcon from '@/assets/fruit-quest/common/icons/auto-harvest.svg';

const HARVEST_REEL_PREVIEW_COUNT = 12;
const HARVEST_REEL_STAGGER_MS = 120;
const HARVEST_REEL_BASE_DURATION_MS = 640;
const HARVEST_REEL_DURATION_INCREMENT_MS = 140;
const GARDEN_CONTENT_TOP_PADDING = 30;
const ORCHARD_NAME_LINE_HEIGHT = 25;
const GARDEN_BOARD_TOP_MARGIN = 10;
const HARVEST_BUTTON_TOP_MARGIN = 20;

const createGardenFruitColumns = (fruitIds) => {
    return [
        [fruitIds[0], fruitIds[3], fruitIds[6]],
        [fruitIds[1], fruitIds[4], fruitIds[7]],
        [fruitIds[2], fruitIds[5], fruitIds[8]],
    ];
};

const createHarvestReelFruitIds = (finalFruitIds) => {
    const previewFruitIds = Array.from({ length: HARVEST_REEL_PREVIEW_COUNT }, () => {
        const fruitIndex = Math.floor(Math.random() * FRUIT_QUEST_CATALOG.length);
        return FRUIT_QUEST_CATALOG[fruitIndex].id;
    });
    return [...previewFruitIds, ...finalFruitIds];
};

export default function FruitQuestGardenScreen() {
    const insets = useSafeAreaInsets();
    const hasHydrated = useFruitQuestStore((state) => state.hasHydrated);
    const gardenFruitIds = useFruitQuestStore((state) => state.gardenFruitIds);
    const harvestFruitGrid = useFruitQuestStore((state) => state.harvestFruitGrid);
    const accelerateEnergyRecovery = useFruitQuestStore((state) => state.accelerateEnergyRecovery);
    const autoHarvestEnabled = useFruitQuestStore((state) => state.autoHarvestEnabled);
    const enableAutoHarvest = useFruitQuestStore((state) => state.enableAutoHarvest);
    const disableAutoHarvest = useFruitQuestStore((state) => state.disableAutoHarvest);
    const { t } = useTranslation();
    const {
        playButtonPress,
        playHarvest,
        playSpin,
        playInsufficientEnergy,
    } = useFruitQuestAudio();
    const {
        gardenContentHorizontalInset,
        gardenBoardSize,
        gardenGridCellSize,
        gardenGridGap,
        gardenFruitDisplaySize,
        gardenUtilityGap,
    } = useFruitQuestPageLayout();
    const [isHarvesting, setIsHarvesting] = useState(false);
    const [harvestReelFruitColumns, setHarvestReelFruitColumns] = useState([]);
    const harvestReelOffsets = useRef([
        new Animated.Value(0),
        new Animated.Value(0),
        new Animated.Value(0),
    ]).current;
    const harvestReelAnimationRef = useRef(null);
    const harvestReelStartFrameRef = useRef(null);
    const harvestInteractionActiveRef = useRef(false);
    const observedGardenFruitIdsRef = useRef(gardenFruitIds);
    const gardenHarvestAnimationReadyRef = useRef(false);
    const [toastMessage, setToastMessage] = useState('');

    useEffect(() => {
        return () => {
            if (harvestReelStartFrameRef.current !== null) {
                cancelAnimationFrame(harvestReelStartFrameRef.current);
            }
            if (harvestReelAnimationRef.current) {
                harvestReelAnimationRef.current.stop();
            }
        };
    }, []);

    useEffect(() => {
        if (!toastMessage) {
            return undefined;
        }
        const toastTimer = setTimeout(() => setToastMessage(''), 1600);
        return () => clearTimeout(toastTimer);
    }, [toastMessage]);

    const playHarvestReel = useCallback((harvestFruitIds) => {
        const reelTravelDistance = HARVEST_REEL_PREVIEW_COUNT * (gardenGridCellSize + gardenGridGap);
        const finalFruitColumns = createGardenFruitColumns(harvestFruitIds);
        const rollingFruitColumns = finalFruitColumns.map(createHarvestReelFruitIds);

        harvestInteractionActiveRef.current = true;
        playSpin();
        harvestReelOffsets.forEach((reelOffset) => reelOffset.setValue(0));
        setHarvestReelFruitColumns(rollingFruitColumns);
        setIsHarvesting(true);

        const reelAnimation = Animated.parallel(
            harvestReelOffsets.map((reelOffset, index) => {
                return Animated.sequence([
                    Animated.delay(index * HARVEST_REEL_STAGGER_MS),
                    Animated.timing(reelOffset, {
                        toValue: -reelTravelDistance,
                        duration: HARVEST_REEL_BASE_DURATION_MS + index * HARVEST_REEL_DURATION_INCREMENT_MS,
                        easing: Easing.out(Easing.cubic),
                        useNativeDriver: true,
                    }),
                ]);
            }),
        );
        harvestReelAnimationRef.current = reelAnimation;
        harvestReelStartFrameRef.current = requestAnimationFrame(() => {
            harvestReelStartFrameRef.current = null;
            reelAnimation.start(({ finished }) => {
                if (!finished) {
                    return;
                }
                harvestReelAnimationRef.current = null;
                harvestInteractionActiveRef.current = false;
                setIsHarvesting(false);
                playHarvest();
            });
        });
    }, [gardenGridCellSize, gardenGridGap, harvestReelOffsets, playHarvest, playSpin]);

    useEffect(() => {
        if (!hasHydrated) {
            return;
        }
        if (!gardenHarvestAnimationReadyRef.current) {
            observedGardenFruitIdsRef.current = gardenFruitIds;
            gardenHarvestAnimationReadyRef.current = true;
            return;
        }
        if (observedGardenFruitIdsRef.current === gardenFruitIds) {
            return;
        }

        observedGardenFruitIdsRef.current = gardenFruitIds;
        playHarvestReel(gardenFruitIds);
    }, [gardenFruitIds, hasHydrated, playHarvestReel]);

    const harvestGardenFruit = useCallback(() => {
        if (harvestInteractionActiveRef.current) {
            return;
        }

        harvestInteractionActiveRef.current = true;
        const harvest = harvestFruitGrid();
        if (harvest.status === 'insufficient_energy') {
            harvestInteractionActiveRef.current = false;
            setIsHarvesting(false);
            setToastMessage(t('能量不足'));
            playInsufficientEnergy();
            return;
        }
    }, [harvestFruitGrid, playInsufficientEnergy, t]);

    const accelerateEnergy = useCallback(() => {
        const energyBoost = accelerateEnergyRecovery();
        if (energyBoost.status === 'accelerated') {
            playButtonPress();
            setToastMessage(t('恢复 {count} 点能量', { count: energyBoost.restoredEnergy }));
            return;
        }
        if (energyBoost.status === 'cooling_down') {
            const remainingSeconds = Math.ceil(energyBoost.remainingMs / 1000);
            setToastMessage(t('加速冷却中，还需 {count} 秒', { count: remainingSeconds }));
            return;
        }
        setToastMessage(t('能量已满'));
    }, [accelerateEnergyRecovery, playButtonPress, t]);

    const toggleAutoHarvest = useCallback(() => {
        playButtonPress();
        if (autoHarvestEnabled) {
            disableAutoHarvest();
            setToastMessage(t('自动收获已关闭'));
            return;
        }
        enableAutoHarvest();
        setToastMessage(t('自动收获已开启'));
    }, [autoHarvestEnabled, disableAutoHarvest, enableAutoHarvest, playButtonPress, t]);

    return (
        <FruitQuestPageFrame activeTab="garden">
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={[
                    styles.content,
                    { paddingHorizontal: gardenContentHorizontalInset },
                ]}
                showsVerticalScrollIndicator={false}
            >
                <Text style={styles.orchardName}>{t('热带果园')}</Text>
                <View
                    style={[
                        styles.gardenFrame,
                        {
                            width: gardenBoardSize,
                            height: gardenBoardSize,
                        },
                    ]}
                >
                    <View pointerEvents="none" style={styles.gardenFrameBorder} />
                    <View style={styles.gardenInnerFrame}>
                        <View style={[styles.fruitGrid, { gap: gardenGridGap }]}>
                            {gardenFruitIds.map((fruitId, index) => (
                                <View
                                    key={`${fruitId}-${index}`}
                                    style={[
                                        styles.fruitCell,
                                        {
                                            width: gardenGridCellSize,
                                            height: gardenGridCellSize,
                                        },
                                    ]}
                                >
                                    <FruitQuestFruitImage fruitId={fruitId} displaySize={gardenFruitDisplaySize} />
                                </View>
                            ))}
                            {isHarvesting && (
                                <View
                                    pointerEvents="none"
                                    style={[styles.harvestReelOverlay, { gap: gardenGridGap }]}
                                >
                                    {harvestReelFruitColumns.map((fruitIds, index) => (
                                        <FruitQuestHarvestReel
                                            key={`harvest-reel-${index}`}
                                            fruitIds={fruitIds}
                                            translateY={harvestReelOffsets[index]}
                                            cellSize={gardenGridCellSize}
                                            gap={gardenGridGap}
                                            fruitDisplaySize={gardenFruitDisplaySize}
                                        />
                                    ))}
                                </View>
                            )}
                        </View>
                    </View>
                </View>
                <Pressable
                    style={styles.harvestButton}
                    disabled={isHarvesting}
                    onPress={harvestGardenFruit}
                >
                    <LinearGradient
                        colors={['#DD30B1', '#4D48F1']}
                        start={{ x: 0.5, y: 0 }}
                        end={{ x: 0.5, y: 1 }}
                        style={styles.harvestButtonGradient}
                    >
                        <Text style={styles.harvestButtonTitle}>{t('收获水果')}</Text>
                        <Text style={styles.harvestButtonCaption}>
                            {t('消耗：{count} 能量', { count: FRUIT_QUEST_HARVEST_ENERGY_COST })}
                        </Text>
                    </LinearGradient>
                </Pressable>
                <View style={[styles.utilityRow, { gap: gardenUtilityGap }]}>
                    <Pressable onPress={accelerateEnergy} style={styles.utilityButton}>
                        <RocketIcon width={20} height={20} />
                        <Text style={styles.utilityButtonText}>{t('加速')}</Text>
                    </Pressable>
                    <Pressable
                        onPress={toggleAutoHarvest}
                        style={[
                            styles.utilityButton,
                            autoHarvestEnabled && styles.autoHarvestEnabledButton,
                        ]}
                    >
                        <AutoHarvestIcon width={20} height={20} />
                        <Text style={[
                            styles.utilityButtonText,
                            autoHarvestEnabled && styles.autoHarvestEnabledButtonText,
                        ]}>{t('自动收获')}</Text>
                    </Pressable>
                </View>
            </ScrollView>
            <Toast message={toastMessage} top={insets.top + 64} />
        </FruitQuestPageFrame>
    );
}

function FruitQuestHarvestReel({
    fruitIds,
    translateY,
    cellSize,
    gap,
    fruitDisplaySize,
}) {
    return (
        <View
            style={[
                styles.fruitReel,
                {
                    width: cellSize,
                    height: cellSize * 3 + gap * 2,
                },
            ]}
        >
            <Animated.View
                style={[
                    styles.fruitReelContent,
                    {
                        gap,
                        transform: [{ translateY }],
                    },
                ]}
            >
                {fruitIds.map((fruitId, index) => (
                    <View
                        key={`${fruitId}-${index}`}
                        style={[
                            styles.fruitCell,
                            {
                                width: cellSize,
                                height: cellSize,
                            },
                        ]}
                    >
                        <FruitQuestFruitImage fruitId={fruitId} displaySize={fruitDisplaySize} />
                    </View>
                ))}
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    scroll: {
        flex: 1,
    },
    content: {
        width: '100%',
        alignItems: 'center',
        paddingTop: GARDEN_CONTENT_TOP_PADDING,
    },
    orchardName: {
        alignSelf: 'stretch',
        textAlign: 'center',
        color: '#E6F4FD',
        fontSize: 18,
        fontWeight: '600',
        lineHeight: ORCHARD_NAME_LINE_HEIGHT,
    },
    gardenFrame: {
        alignSelf: 'center',
        marginTop: GARDEN_BOARD_TOP_MARGIN,
        padding: 10,
        borderRadius: 10,
        backgroundColor: '#23416A',
    },
    gardenFrameBorder: {
        ...StyleSheet.absoluteFill,
        borderWidth: 1,
        borderColor: '#1F7799',
        borderRadius: 10,
    },
    gardenInnerFrame: {
        flex: 1,
        padding: 10,
        borderRadius: 10,
        backgroundColor: '#08152D',
        boxShadow: '0px 0px 10px rgba(0, 0, 0, 0.5)',
    },
    fruitGrid: {
        flex: 1,
        flexDirection: 'row',
        flexWrap: 'wrap',
        position: 'relative',
    },
    harvestReelOverlay: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        flexDirection: 'row',
    },
    fruitReel: {
        overflow: 'hidden',
        borderRadius: 10,
    },
    fruitReelContent: {
        alignItems: 'center',
    },
    fruitCell: {
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 10,
        backgroundColor: '#1F2837',
    },
    harvestButton: {
        alignSelf: 'stretch',
        height: 60,
        marginTop: HARVEST_BUTTON_TOP_MARGIN,
        overflow: 'hidden',
        borderRadius: 10,
    },
    harvestButtonGradient: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    harvestButtonTitle: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '600',
        lineHeight: 25,
    },
    harvestButtonCaption: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '400',
        lineHeight: 17,
    },
    utilityRow: {
        alignSelf: 'stretch',
        flexDirection: 'row',
        marginTop: 10,
    },
    utilityButton: {
        flex: 1,
        height: 40,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        borderWidth: 1,
        borderColor: '#3D3F51',
        borderRadius: 10,
        backgroundColor: '#1F2837',
    },
    utilityButtonText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
        lineHeight: 17,
    },
    autoHarvestEnabledButton: {
        borderColor: '#08C8FF',
    },
    autoHarvestEnabledButtonText: {
        color: '#08C8FF',
    },
});
