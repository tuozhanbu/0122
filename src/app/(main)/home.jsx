import React, { useCallback } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import FruitQuestPageFrame from '@/components/fruitQuest/FruitQuestPageFrame';
import FruitQuestFruitImage from '@/components/fruitQuest/FruitQuestFruitImage';
import { useFruitQuestAudio } from '@/components/fruitQuest/FruitQuestAudioProvider';
import useTranslation from '@/hooks/useTranslation';
import useFruitQuestPageLayout from '@/hooks/useFruitQuestPageLayout';
import useFruitQuestStore from '@/store/useFruitQuestStore';
import { getFruitQuestFruit } from '@/store/fruitQuestCatalog';
import DailyOrderIcon from '@/assets/fruit-quest/common/icons/daily-order.svg';

const homeBanner = {
    zh: require('@/assets/fruit-quest/home/home-banner-zh.png'),
    en: require('@/assets/fruit-quest/home/home-banner-en.png'),
};
const HOME_BANNER_ASPECT_RATIO = 690 / 280;

export default function FruitQuestHomeScreen() {
    const router = useRouter();
    const { lang, t } = useTranslation();
    const {
        standardContentHorizontalInset,
        standardContentWidth,
    } = useFruitQuestPageLayout();
    const homeBannerHeight = standardContentWidth / HOME_BANNER_ASPECT_RATIO;
    const fruitOrders = useFruitQuestStore((state) => state.fruitOrders);
    const claimFruitOrder = useFruitQuestStore((state) => state.claimFruitOrder);
    const { playButtonPress, playOrderClaimed } = useFruitQuestAudio();

    const openGarden = useCallback(() => {
        playButtonPress();
        router.replace('/garden');
    }, [playButtonPress, router]);

    const claimOrderReward = useCallback((orderId) => {
        const claim = claimFruitOrder(orderId);
        if (claim.status === 'claimed') {
            playOrderClaimed();
        }
    }, [claimFruitOrder, playOrderClaimed]);

    return (
        <FruitQuestPageFrame activeTab="home">
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={[
                    styles.content,
                    { paddingHorizontal: standardContentHorizontalInset },
                ]}
                showsVerticalScrollIndicator={false}
            >
                <Pressable
                    onPress={openGarden}
                    style={[
                        styles.bannerPressable,
                        {
                            width: standardContentWidth,
                            height: homeBannerHeight,
                        },
                    ]}
                >
                    <Image
                        source={homeBanner[lang]}
                        style={styles.banner}
                        resizeMode="contain"
                    />
                </Pressable>
                <View style={styles.ordersHeading}>
                    <DailyOrderIcon width={24} height={24} />
                    <Text style={styles.ordersTitle}>{t('每日订单')}</Text>
                </View>
                {Object.values(fruitOrders).map((order) => (
                    <FruitQuestOrderCard
                        key={order.id}
                        order={order}
                        onClaim={() => claimOrderReward(order.id)}
                    />
                ))}
            </ScrollView>
        </FruitQuestPageFrame>
    );
}

function FruitQuestOrderCard({ order, onClaim }) {
    const { t } = useTranslation();
    const fruit = getFruitQuestFruit(order.fruitId);
    const complete = order.submittedCount >= order.requiredCount;
    const canClaim = complete && !order.claimed;
    const rewardText = t('奖励：{count}经验', { count: order.experienceReward });
    const [rewardPrefix, rewardSuffix] = rewardText.split(String(order.experienceReward));

    return (
        <View style={styles.orderCard}>
            <View style={styles.orderTopRow}>
                <View style={styles.orderFruitLabel}>
                    <FruitQuestFruitImage fruitId={order.fruitId} displaySize={24} />
                    <Text style={styles.orderFruitText}>{t(fruit.nameKey)} {t('x{count}', { count: order.requiredCount })}</Text>
                </View>
                <Text style={[styles.orderProgress, !complete && styles.incompleteProgress]}>
                    {order.submittedCount}/{order.requiredCount}
                </Text>
            </View>
            <View style={styles.orderRewardRow}>
                <Text style={styles.orderRewardText}>
                    <Text style={styles.rewardPrefix}>{rewardPrefix}</Text>
                    <Text style={styles.rewardValue}>{order.experienceReward}{rewardSuffix}</Text>
                </Text>
                {canClaim ? (
                    <Pressable onPress={onClaim} style={styles.claimButton}>
                        <LinearGradient
                            colors={['#DD30B1', '#4D48F1']}
                            start={{ x: 0.5, y: 0 }}
                            end={{ x: 0.5, y: 1 }}
                            style={styles.claimButtonGradient}
                        >
                            <Text style={styles.claimButtonText}>{t('领取')}</Text>
                        </LinearGradient>
                    </Pressable>
                ) : (
                    <View style={styles.disabledClaimButton}>
                        <Text style={styles.disabledClaimButtonText}>{t('领取')}</Text>
                    </View>
                )}
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
        alignSelf: 'center',
        paddingTop: 20,
        paddingBottom: 22,
    },
    bannerPressable: {
        alignSelf: 'center',
        borderRadius: 10,
        overflow: 'hidden',
    },
    banner: {
        width: '100%',
        height: '100%',
    },
    ordersHeading: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 20,
        marginBottom: 10,
    },
    ordersTitle: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '600',
        lineHeight: 25,
    },
    orderCard: {
        marginBottom: 16,
        gap: 4,
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: '#181D2E',
    },
    orderTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    orderFruitLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    orderFruitText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '400',
        lineHeight: 20,
    },
    orderProgress: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '400',
        lineHeight: 20,
    },
    incompleteProgress: {
        color: '#9DA2A9',
    },
    orderRewardRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    orderRewardText: {
        fontSize: 14,
        lineHeight: 20,
    },
    rewardPrefix: {
        color: '#FFFFFF',
        fontWeight: '400',
    },
    rewardValue: {
        color: '#08C8FF',
        fontWeight: '600',
    },
    claimButton: {
        width: 60,
        height: 24,
        borderRadius: 40,
        overflow: 'hidden',
    },
    claimButtonGradient: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    claimButtonText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
        lineHeight: 16,
    },
    disabledClaimButton: {
        width: 60,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 40,
        backgroundColor: '#374051',
    },
    disabledClaimButtonText: {
        color: '#9DA2A9',
        fontSize: 12,
        fontWeight: '600',
        lineHeight: 16,
    },
});
