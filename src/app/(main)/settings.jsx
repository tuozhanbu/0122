import React, { useCallback, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import FruitQuestPageFrame from '@/components/fruitQuest/FruitQuestPageFrame';
import useTranslation from '@/hooks/useTranslation';
import useFruitQuestPageLayout from '@/hooks/useFruitQuestPageLayout';
import useLangStore from '@/store/useLangStore';
import useFruitQuestStore from '@/store/useFruitQuestStore';
import LanguageIcon from '@/assets/fruit-quest/common/icons/setting-language.svg';
import GuideIcon from '@/assets/fruit-quest/common/icons/setting-guide.svg';
import SoundIcon from '@/assets/fruit-quest/common/icons/setting-sound.svg';
import AboutIcon from '@/assets/fruit-quest/common/icons/setting-about.svg';
import PrivacyIcon from '@/assets/fruit-quest/common/icons/setting-privacy.svg';
import ChevronIcon from '@/assets/fruit-quest/common/icons/setting-chevron.svg';
import SwitchThumb from '@/assets/fruit-quest/common/icons/switch-thumb.svg';

const aboutEmblem = require('@/assets/fruit-quest/common/about-emblem.png');
const PRIVACY_POLICY_URL = Platform.select({
    ios: 'https://privacy.xinku168.com/agreement?type=habit7bt',
    android: 'https://privacy.xinku168.com/agreement?type=7buhabit',
});

export default function FruitQuestSettingsScreen() {
    const { lang, t } = useTranslation();
    const {
        settingsContentHorizontalInset,
    } = useFruitQuestPageLayout();
    const switchLang = useLangStore((state) => state.switchLang);
    const backgroundMusicEnabled = useFruitQuestStore((state) => state.backgroundMusicEnabled);
    const soundEffectsEnabled = useFruitQuestStore((state) => state.soundEffectsEnabled);
    const enableBackgroundMusic = useFruitQuestStore((state) => state.enableBackgroundMusic);
    const disableBackgroundMusic = useFruitQuestStore((state) => state.disableBackgroundMusic);
    const enableSoundEffects = useFruitQuestStore((state) => state.enableSoundEffects);
    const disableSoundEffects = useFruitQuestStore((state) => state.disableSoundEffects);
    const router = useRouter();
    const [expandedSetting, setExpandedSetting] = useState('language');

    const expandLanguageSettings = useCallback(() => setExpandedSetting('language'), []);
    const expandGuideSettings = useCallback(() => setExpandedSetting('guide'), []);
    const expandSoundSettings = useCallback(() => setExpandedSetting('sound'), []);
    const expandAboutSettings = useCallback(() => setExpandedSetting('about'), []);
    const openPrivacyPolicy = useCallback(() => {
        if (!PRIVACY_POLICY_URL) {
            return;
        }
        router.push(`/webview?url=${encodeURIComponent(PRIVACY_POLICY_URL)}`);
    }, [router]);
    const selectChineseLanguage = useCallback(() => switchLang('zh'), [switchLang]);
    const selectEnglishLanguage = useCallback(() => switchLang('en'), [switchLang]);

    return (
        <FruitQuestPageFrame activeTab="settings">
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={[
                    styles.content,
                    { paddingHorizontal: settingsContentHorizontalInset },
                ]}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.settingsCard}>
                    <SettingNavigationRow
                        icon={LanguageIcon}
                        label={t('语言/Language')}
                        expanded={expandedSetting === 'language'}
                        onPress={expandLanguageSettings}
                        lastRow={false}
                    />
                    {expandedSetting === 'language' && (
                        <View style={styles.languagePanel}>
                            <Pressable
                                onPress={selectChineseLanguage}
                                style={[styles.languageButton, lang === 'zh' && styles.selectedLanguageButton]}
                            >
                                <Text style={[styles.languageButtonText, lang === 'zh' && styles.selectedLanguageButtonText]}>
                                    {t('中文')}
                                </Text>
                            </Pressable>
                            <Pressable
                                onPress={selectEnglishLanguage}
                                style={[styles.languageButton, lang === 'en' && styles.selectedLanguageButton]}
                            >
                                <Text style={[styles.languageButtonText, lang === 'en' && styles.selectedLanguageButtonText]}>
                                    English
                                </Text>
                            </Pressable>
                        </View>
                    )}

                    <SettingNavigationRow
                        icon={GuideIcon}
                        label={t('游戏指南')}
                        expanded={expandedSetting === 'guide'}
                        onPress={expandGuideSettings}
                        lastRow={false}
                    />
                    {expandedSetting === 'guide' && <FruitQuestGuidePanel />}

                    <SettingNavigationRow
                        icon={SoundIcon}
                        label={t('声音选项')}
                        expanded={expandedSetting === 'sound'}
                        onPress={expandSoundSettings}
                        lastRow={false}
                    />
                    {expandedSetting === 'sound' && (
                        <View style={styles.soundPanel}>
                            <View pointerEvents="none" style={styles.soundPanelTopDivider} />
                            <SoundPreferenceRow
                                title={t('背景音乐（BGM）')}
                                description={t('开启或关闭果园背景音乐')}
                                enabled={backgroundMusicEnabled}
                                onEnable={enableBackgroundMusic}
                                onDisable={disableBackgroundMusic}
                            />
                            <SoundPreferenceRow
                                title={t('游戏音效（SFX）')}
                                description={t('收获，按钮点击等提示音')}
                                enabled={soundEffectsEnabled}
                                onEnable={enableSoundEffects}
                                onDisable={disableSoundEffects}
                            />
                        </View>
                    )}

                    <SettingNavigationRow
                        icon={PrivacyIcon}
                        label={t('隐私政策')}
                        onPress={openPrivacyPolicy}
                        lastRow={false}
                    />

                    <SettingNavigationRow
                        icon={AboutIcon}
                        label={t('关于水果探险家')}
                        expanded={expandedSetting === 'about'}
                        onPress={expandAboutSettings}
                        lastRow
                    />
                    {expandedSetting === 'about' && <FruitQuestAboutPanel />}
                </View>
            </ScrollView>
        </FruitQuestPageFrame>
    );
}

function SettingNavigationRow({ icon: Icon, label, expanded, onPress, lastRow }) {
    return (
        <Pressable
            onPress={onPress}
            style={[
                styles.navigationRow,
                !lastRow && !expanded && styles.navigationRowDivider,
            ]}
        >
            <View style={styles.navigationRowLabel}>
                {Icon ? <Icon width={24} height={24} /> : <View style={styles.navigationRowIconSpacer} />}
                <Text style={styles.navigationRowText}>{label}</Text>
            </View>
            <View style={expanded && styles.expandedChevron}>
                <ChevronIcon width={20} height={20} />
            </View>
        </Pressable>
    );
}

function FruitQuestGuidePanel() {
    const { t } = useTranslation();

    return (
        <View style={styles.guidePanel}>
            <Text style={styles.guideText}>
                <Text style={styles.guideHeading}>{t('核心玩法：')} </Text>
                {t('消耗 5 点能量点击 “收获水果”，每次将随机获得 9 个水果。')}{'\n'}
                <Text style={styles.guideHeading}>{t('能量恢复：')} </Text>
                {t('能量每 5 秒自动恢复 1 点，上限为 100 点。')}{'\n'}
                <Text style={styles.guideHeading}>{t('水果稀有度：')} </Text>
                {t('分为普通（绿色边框）、稀有（蓝色边框）、传奇（粉色边框）。集齐所有图鉴成为水果大师！')}{'\n'}
                <Text style={styles.guideHeading}>{t('每日订单：')} </Text>
                {t('在首页完成水果提交订单，可获得丰厚经验奖励，提升玩家等级。')}
            </Text>
        </View>
    );
}

function SoundPreferenceRow({ title, description, enabled, onEnable, onDisable }) {
    return (
        <View style={styles.soundPreferenceRow}>
            <View style={styles.soundPreferenceTextGroup}>
                <Text style={styles.soundPreferenceTitle}>{title}</Text>
                <Text style={styles.soundPreferenceDescription}>{description}</Text>
            </View>
            <Pressable onPress={enabled ? onDisable : onEnable} style={[styles.switchTrack, enabled && styles.enabledSwitchTrack]}>
                <View style={[styles.switchThumb, enabled && styles.enabledSwitchThumb]}>
                    <SwitchThumb width={16} height={16} />
                </View>
            </Pressable>
        </View>
    );
}

function FruitQuestAboutPanel() {
    const { t } = useTranslation();
    const appVersion = Constants.expoConfig?.version ?? '';

    return (
        <View style={styles.aboutPanel}>
            <Image source={aboutEmblem} style={styles.aboutEmblem} resizeMode="contain" />
            <View style={styles.aboutTextGroup}>
                <Text style={styles.aboutTitle}>{t('水果探险家')}</Text>
                <Text style={styles.aboutVersion}>v{appVersion}</Text>
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
        alignItems: 'center',
        paddingTop: 20,
        paddingBottom: 16,
    },
    settingsCard: {
        alignSelf: 'stretch',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#1F2837',
        borderRadius: 10,
        backgroundColor: '#181D2E',
    },
    navigationRow: {
        height: 60,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
    },
    navigationRowDivider: {
        borderBottomWidth: 1,
        borderBottomColor: '#1F2837',
    },
    navigationRowLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    navigationRowText: {
        color: '#D1D5DC',
        fontSize: 16,
        fontWeight: '400',
        lineHeight: 22,
    },
    expandedChevron: {
        transform: [{ rotate: '90deg' }],
    },
    languagePanel: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 15,
        paddingVertical: 20,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#1F2837',
        backgroundColor: '#0A0C1A',
    },
    languageButton: {
        flex: 1,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#3D3F51',
        borderRadius: 10,
        backgroundColor: '#1F2837',
    },
    selectedLanguageButton: {
        borderColor: '#08C8FF',
    },
    languageButtonText: {
        color: '#9DA2AF',
        fontSize: 14,
        fontWeight: '400',
        lineHeight: 20,
    },
    selectedLanguageButtonText: {
        color: '#08C8FF',
        fontWeight: '600',
    },
    guidePanel: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#1F2837',
        backgroundColor: '#0A0C1A',
    },
    guideText: {
        color: '#9DA2AF',
        fontSize: 14,
        fontWeight: '400',
        lineHeight: 20,
    },
    guideHeading: {
        color: '#08C8FF',
        fontWeight: '600',
    },
    soundPanel: {
        position: 'relative',
        backgroundColor: '#0A0C1A',
    },
    soundPanelTopDivider: {
        top: 0,
        right: 0,
        left: 0,
        height: 1,
        position: 'absolute',
        backgroundColor: '#1F2837',
    },
    soundPreferenceRow: {
        height: 60,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#1F2837',
    },
    soundPreferenceTextGroup: {
        flexShrink: 1,
        gap: 2,
        paddingRight: 10,
    },
    soundPreferenceTitle: {
        color: '#D1D5DC',
        fontSize: 16,
        fontWeight: '600',
        lineHeight: 22,
    },
    soundPreferenceDescription: {
        color: '#6C7180',
        fontSize: 12,
        fontWeight: '400',
        lineHeight: 17,
    },
    switchTrack: {
        width: 50,
        height: 24,
        justifyContent: 'center',
        paddingHorizontal: 6,
        borderRadius: 50,
        backgroundColor: '#CCCCCE',
    },
    enabledSwitchTrack: {
        alignItems: 'flex-end',
        backgroundColor: '#08C8FF',
    },
    switchThumb: {
        width: 16,
        height: 16,
    },
    enabledSwitchThumb: {
        alignSelf: 'flex-end',
    },
    navigationRowIconSpacer: {
        width: 24,
        height: 24,
    },
    aboutPanel: {
        alignItems: 'center',
        paddingTop: 9,
        paddingBottom: 10,
        borderTopWidth: 1,
        borderColor: '#1F2837',
        backgroundColor: '#0A0C1A',
    },
    aboutEmblem: {
        width: 48,
        height: 48,
        marginBottom: 10,
    },
    aboutTextGroup: {
        alignItems: 'center',
        gap: 1,
    },
    aboutTitle: {
        color: '#D1D5DC',
        fontSize: 24,
        fontWeight: '600',
        lineHeight: 30,
    },
    aboutVersion: {
        color: '#D1D5DC',
        fontSize: 16,
        fontWeight: '400',
        lineHeight: 22,
    },
});
