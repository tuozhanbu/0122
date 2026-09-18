import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import useTranslation from '@/hooks/useTranslation';
import useFruitQuestPageLayout from '@/hooks/useFruitQuestPageLayout';
import { FRUIT_QUEST_CATALOG, FRUIT_QUEST_ENERGY_LIMIT } from '@/store/fruitQuestCatalog';
import useFruitQuestStore from '@/store/useFruitQuestStore';
import ExperienceIcon from '@/assets/fruit-quest/common/icons/experience.svg';
import EnergyIcon from '@/assets/fruit-quest/common/icons/energy.svg';
import CollectionIcon from '@/assets/fruit-quest/common/icons/collection.svg';

const questLogo = require('@/assets/fruit-quest/common/about-emblem.png');

export default function QuestPlayerStatus() {
    const energy = useFruitQuestStore((state) => state.energy);
    const experience = useFruitQuestStore((state) => state.experience);
    const fruitQuantities = useFruitQuestStore((state) => state.fruitQuantities);
    const { t } = useTranslation();
    const { playerStatusGap } = useFruitQuestPageLayout();
    const collectedFruitCount = FRUIT_QUEST_CATALOG.filter((fruit) => fruitQuantities[fruit.id] > 0).length;
    const playerLevel = Math.floor(experience / 100) + 1;

    return (
        <View style={[styles.row, { gap: playerStatusGap }]}>
            <View style={styles.playerCard}>
                <LinearGradient
                    colors={['#DD30B1', '#4D48F1']}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={styles.playerAvatarBackground}
                >
                    <Image source={questLogo} style={styles.playerAvatar} resizeMode="contain" />
                </LinearGradient>
                <View style={styles.playerTextGroup}>
                    <Text style={styles.playerName} numberOfLines={1}>{t('玩家 ID:探索者')}</Text>
                    <View style={styles.levelRow}>
                        <Text style={styles.playerLevel}>{t('Lv.{level}', { level: playerLevel })}</Text>
                        <ExperienceIcon width={14} height={14} />
                    </View>
                </View>
            </View>
            <View style={styles.statGroup}>
                <View style={styles.statCard}>
                    <EnergyIcon width={20} height={20} />
                    <Text style={styles.statValue}>{energy}/{FRUIT_QUEST_ENERGY_LIMIT}</Text>
                </View>
                <View style={styles.statCard}>
                    <CollectionIcon width={20} height={20} />
                    <Text style={styles.statValue}>{collectedFruitCount}/{FRUIT_QUEST_CATALOG.length}</Text>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        height: 60,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    playerCard: {
        flex: 1.03,
        height: 60,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: '#531F86',
        borderRadius: 6,
        backgroundColor: '#180732',
    },
    playerAvatarBackground: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 6,
    },
    playerAvatar: {
        width: 40,
        height: 40,
    },
    playerTextGroup: {
        flexShrink: 1,
        gap: 2,
    },
    playerName: {
        color: '#EEDEFF',
        fontSize: 14,
        fontWeight: '600',
        lineHeight: 20,
    },
    levelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    playerLevel: {
        color: '#EEDEFF',
        fontSize: 12,
        fontWeight: '400',
        lineHeight: 18,
    },
    statGroup: {
        flex: 1,
        flexDirection: 'row',
        gap: 10,
    },
    statCard: {
        flex: 1,
        height: 60,
        paddingVertical: 6,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 2,
        borderWidth: 1,
        borderColor: '#531F86',
        borderRadius: 6,
        backgroundColor: '#180732',
    },
    statValue: {
        color: '#EEDEFF',
        fontSize: 14,
        fontWeight: '600',
        lineHeight: 20,
    },
});
