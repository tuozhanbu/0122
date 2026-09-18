import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import FruitQuestFruitImage from '@/components/fruitQuest/FruitQuestFruitImage';
import { useFruitQuestAudio } from '@/components/fruitQuest/FruitQuestAudioProvider';
import FruitQuestPageFrame from '@/components/fruitQuest/FruitQuestPageFrame';
import useTranslation from '@/hooks/useTranslation';
import useFruitQuestPageLayout from '@/hooks/useFruitQuestPageLayout';
import {
    FRUIT_QUEST_COLLECTION_DISPLAY_ORDER,
    getFruitQuestFruit,
} from '@/store/fruitQuestCatalog';
import useFruitQuestStore from '@/store/useFruitQuestStore';
import UnknownFruitIcon from '@/assets/fruit-quest/common/icons/unknown-fruit.svg';
import DiscoveryCloseIcon from '@/assets/fruit-quest/collection/icons/discovery-close.svg';

const RARITY_BORDER_COLORS = {
    普通: '#22C55E',
    稀有: '#08C8FF',
    传奇: '#EC4899',
};

export default function FruitQuestCollectionScreen() {
    const fruitQuantities = useFruitQuestStore((state) => state.fruitQuantities);
    const unseenFruitIds = useFruitQuestStore((state) => state.unseenFruitIds);
    const markFruitDiscoveriesSeen = useFruitQuestStore((state) => state.markFruitDiscoveriesSeen);
    const { lang, t } = useTranslation();
    const { playButtonPress } = useFruitQuestAudio();
    const {
        standardContentHorizontalInset,
        collectionGap,
        collectionCardWidth,
        collectionFruitDisplaySize,
    } = useFruitQuestPageLayout();
    const [discoveryNoticeVisible, setDiscoveryNoticeVisible] = useState(false);

    useEffect(() => {
        if (unseenFruitIds.length > 0) {
            setDiscoveryNoticeVisible(true);
        }
    }, [unseenFruitIds]);

    const closeDiscoveryNotice = useCallback(() => {
        playButtonPress();
        markFruitDiscoveriesSeen();
        setDiscoveryNoticeVisible(false);
    }, [markFruitDiscoveriesSeen, playButtonPress]);

    const newFruitNames = unseenFruitIds
        .map((fruitId) => t(getFruitQuestFruit(fruitId).nameKey))
        .join(lang === 'zh' ? '，' : ', ');

    return (
        <>
            <FruitQuestPageFrame activeTab="collection">
                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={[
                        styles.content,
                        { paddingHorizontal: standardContentHorizontalInset },
                    ]}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.heading}>
                        <Text style={styles.title}>{t('收获（图鉴标题）')}</Text>
                        <Text style={styles.subtitle}>{t('解锁全部水果')}</Text>
                    </View>
                    <View style={[styles.fruitGrid, { gap: collectionGap }]}>
                        {FRUIT_QUEST_COLLECTION_DISPLAY_ORDER.map((fruitId) => (
                            <FruitCollectionCard
                                key={fruitId}
                                fruitId={fruitId}
                                quantity={fruitQuantities[fruitId] ?? 0}
                                cardWidth={collectionCardWidth}
                                fruitDisplaySize={collectionFruitDisplaySize}
                            />
                        ))}
                    </View>
                </ScrollView>
            </FruitQuestPageFrame>
            <FruitDiscoveryNotice
                visible={discoveryNoticeVisible}
                fruitNames={newFruitNames}
                onClose={closeDiscoveryNotice}
            />
        </>
    );
}

function FruitDiscoveryNotice({ visible, fruitNames, onClose }) {
    const { t } = useTranslation();

    return (
        <Modal
            transparent
            statusBarTranslucent
            animationType="fade"
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.discoveryNoticeBackdrop}>
                <View style={styles.discoveryNoticePositioner}>
                    <View style={styles.discoveryNoticeCard}>
                        <Text style={styles.discoveryNoticeTitle}>{t('新发现！')}</Text>
                        <Text style={styles.discoveryNoticeText}>{t('{fruitNames}！', { fruitNames })}</Text>
                    </View>
                    <Pressable
                        accessibilityLabel={t('关闭新发现提示')}
                        hitSlop={10}
                        style={styles.discoveryNoticeCloseButton}
                        onPress={onClose}
                    >
                        <DiscoveryCloseIcon width={40} height={40} />
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
}

function FruitCollectionCard({ fruitId, quantity, cardWidth, fruitDisplaySize }) {
    const { t } = useTranslation();
    const fruit = getFruitQuestFruit(fruitId);
    const unlocked = quantity > 0;
    const borderColor = unlocked ? RARITY_BORDER_COLORS[fruit.rarityKey] : '#08C8FF';

    return (
        <View style={[styles.fruitCard, { width: cardWidth, borderColor }]}>
            {unlocked ? (
                <FruitQuestFruitImage fruitId={fruitId} displaySize={fruitDisplaySize} />
            ) : (
                <UnknownFruitIcon width={fruitDisplaySize} height={fruitDisplaySize} />
            )}
            <View style={styles.fruitDetails}>
                <View style={styles.fruitNameRow}>
                    <Text style={styles.fruitName} numberOfLines={1}>
                        {unlocked ? t(fruit.nameKey) : t('未知')}
                    </Text>
                    {unlocked && (
                        <View style={styles.quantityBadge}>
                            <Text style={styles.quantityText}>{t('x{count}', { count: quantity })}</Text>
                        </View>
                    )}
                </View>
                <Text style={styles.rarityText}>{unlocked ? t(fruit.rarityKey) : t('未知')}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    scroll: {
        flex: 1,
    },
    content: {
        width: '100%',
        paddingTop: 10,
        paddingBottom: 18,
    },
    heading: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    title: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '600',
        lineHeight: 25,
    },
    subtitle: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '400',
        lineHeight: 16,
    },
    fruitGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    fruitCard: {
        aspectRatio: 108 / 130,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        padding: 10,
        borderWidth: 1,
        borderColor: '#08C8FF',
        borderRadius: 10,
        backgroundColor: '#181D2E',
    },
    fruitDetails: {
        alignItems: 'center',
    },
    fruitNameRow: {
        maxWidth: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
    },
    fruitName: {
        flexShrink: 1,
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
        lineHeight: 20,
    },
    quantityBadge: {
        minWidth: 30,
        height: 18,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
        borderRadius: 20,
        backgroundColor: '#08C8FF',
    },
    quantityText: {
        color: '#181D2E',
        fontSize: 12,
        fontWeight: '600',
        lineHeight: 16,
    },
    rarityText: {
        color: '#9DA2A9',
        fontSize: 12,
        fontWeight: '400',
        lineHeight: 16,
    },
    discoveryNoticeBackdrop: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.58)',
    },
    discoveryNoticePositioner: {
        width: '79.2%',
        alignItems: 'center',
        transform: [{ translateY: -48 }],
    },
    discoveryNoticeCard: {
        alignSelf: 'stretch',
        minHeight: 180,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        paddingHorizontal: 20,
        paddingVertical: 34,
        borderTopWidth: 3,
        borderBottomWidth: 3,
        borderColor: '#743CF7',
        borderRadius: 10,
        backgroundColor: '#181D2E',
    },
    discoveryNoticeTitle: {
        color: '#08C8FF',
        fontSize: 24,
        fontWeight: '600',
        lineHeight: 34,
        textAlign: 'center',
    },
    discoveryNoticeText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '400',
        lineHeight: 24,
        textAlign: 'center',
    },
    discoveryNoticeCloseButton: {
        width: 40,
        height: 40,
        marginTop: 20,
    },
});
