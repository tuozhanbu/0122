import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView,
    TouchableOpacity, Modal, Pressable, FlatList, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from 'expo-router';
import Button from '@/components/common/Button';
import { Colors, FontSize, FontWeight, Spacing } from '@/constants/theme';
import useUserStore from '@/store/useUserStore';
import useLangStore from '@/store/useLangStore';
import useTranslation from '@/hooks/useTranslation';
import { createSoundEffectPlayback } from '@/services/audioPlayback';
import { triggerMediumImpactHaptic } from '@/services/hapticFeedback';
import { createLogger } from '@/utils/logger';
import AsyncStorage from '@react-native-async-storage/async-storage';

const sampleClickSoundAsset = require('@/assets/example/sample-click.mp3');
const logger = createLogger('ExampleScreen');

export default function ExampleScreen() {
    const isLoggedIn = useUserStore((state) => state.isLoggedIn);
    const { switchLang, supportedLangs } = useLangStore();
    const { lang, translations, t } = useTranslation();
    const navigation = useNavigation();
    const [langModalVisible, setLangModalVisible] = useState(false);
    const [switching, setSwitching] = useState(false);
    const sampleSoundPlaybackRef = useRef(null);

    useLayoutEffect(() => {
        const sampleSoundPlayback = createSoundEffectPlayback(sampleClickSoundAsset);
        sampleSoundPlaybackRef.current = sampleSoundPlayback;
        return () => {
            sampleSoundPlayback.dispose();
            if (sampleSoundPlaybackRef.current === sampleSoundPlayback) {
                sampleSoundPlaybackRef.current = null;
            }
        };
    }, []);

    const playSampleSound = useCallback(async () => {
        try {
            await sampleSoundPlaybackRef.current.play();
        } catch (error) {
            logger.warn('sample sound failed', { error });
        }
    }, []);

    const triggerSampleHaptic = useCallback(async () => {
        try {
            await triggerMediumImpactHaptic();
        } catch (error) {
            logger.warn('sample haptic failed', { error });
        }
    }, []);

    // 设置导航栏右侧语言切换按钮
    useLayoutEffect(() => {
        navigation.setOptions({
            headerShown: true,
            animation: 'none',
            title: t('首页'),
            headerRight: () => (
                <TouchableOpacity
                    style={styles.langBtn}
                    onPress={() => setLangModalVisible(true)}
                    activeOpacity={0.7}
                >
                    <Text style={styles.langBtnText}>
                        {supportedLangs[lang] || lang.toUpperCase()} 🌐
                    </Text>
                </TouchableOpacity>
            ),
        });
    }, [navigation, lang, supportedLangs, translations, t]);

    const handleSelectLang = useCallback(async (code) => {
        if (code === lang) {
            setLangModalVisible(false);
            return;
        }
        setSwitching(true);
        try {
            await switchLang(code);
        } catch (error) {
            logger.warn('switch language failed', { lang: code, error });
        } finally {
            setSwitching(false);
            setLangModalVisible(false);
        }
    }, [lang, switchLang]);

    // 将 supportedLangs 对象转为数组
    const langList = Object.entries(supportedLangs).map(([code, name]) => ({ code, name }));

    return (
        <SafeAreaView style={styles.safe} edges={['bottom']}>
            <StatusBar barStyle="dark-content" />
            <ScrollView contentContainerStyle={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.title}>🚀 baseApp</Text>
                    <Text style={styles.subtitle}>React Native + Expo {t('项目模板')}</Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>{t('当前状态')}</Text>
                    <Text style={styles.cardText}>
                        {t('登录状态')}：{isLoggedIn ? `✅ ${t('已登录')}` : `❌ ${t('未登录')}`}
                    </Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>📁 {t('项目结构')}</Text>
                    {[
                        ['src/app/', t('路由页面')],
                        ['src/components/', t('公共组件')],
                        ['src/constants/', t('主题')],
                        ['src/hooks/', t('自定义')],
                        ['src/services/', t('请求封装')],
                        ['src/store/', t('全局状态')],
                        ['src/utils/', t('工具函数')],
                    ].map(([path, desc], i) => (
                        <Text key={i} style={styles.codeText}>{path.padEnd(18)}{desc}</Text>
                    ))}
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>🧩 {t('组件示例')}</Text>
                    <View style={styles.buttonGroup}>
                        <LinearGradient
                            colors={['#4A6FFF', '#18B69B']}
                            start={{ x: 0, y: 0.5 }}
                            end={{ x: 1, y: 0.5 }}
                            style={styles.gradientSample}
                        >
                            <Text style={styles.gradientSampleText}>{t('渐变示例')}</Text>
                        </LinearGradient>
                        <Button title={t('播放声音')} variant="outline" onPress={playSampleSound} fullWidth />
                        <Button title={t('点击震动')} variant="outline" onPress={triggerSampleHaptic} fullWidth />
                        <Button title={`Primary ${t('按钮')}`} onPress={() => { }} fullWidth />
                        <Button title={`Outline ${t('按钮')}`} variant="outline" onPress={() => { }} fullWidth />
                        <Button title={`Ghost ${t('按钮')}`} variant="ghost" onPress={() => { }} fullWidth />
                        <Button title={t('加载中')} loading onPress={() => { }} fullWidth />
                        <Button title={t('禁用状态')} disabled onPress={() => { }} fullWidth />
                        <Button title={t('彻底清理本地数据')} onPress={() => AsyncStorage.clear()} />
                    </View>
                </View>
            </ScrollView>

            {/* 语言选择弹窗 */}
            <Modal
                visible={langModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setLangModalVisible(false)}
            >
                <Pressable style={styles.overlay} onPress={() => setLangModalVisible(false)}>
                    <Pressable style={styles.langModal} onPress={(e) => e.stopPropagation()}>
                        <Text style={styles.langModalTitle}>🌐 {t('选择语言')}</Text>
                        {langList.length === 0 ? (
                            <Text style={styles.langEmptyText}>{t('暂无可切换语言')}</Text>
                        ) : (
                            <FlatList
                                data={langList}
                                keyExtractor={(item) => item.code}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={[
                                            styles.langItem,
                                            item.code === lang && styles.langItemActive,
                                        ]}
                                        onPress={() => handleSelectLang(item.code)}
                                        disabled={switching}
                                        activeOpacity={0.7}
                                    >
                                        <Text
                                            style={[
                                                styles.langItemText,
                                                item.code === lang && styles.langItemTextActive,
                                            ]}
                                        >
                                            {item.name}
                                        </Text>
                                        {item.code === lang && (
                                            <Text style={styles.checkmark}>✅</Text>
                                        )}
                                    </TouchableOpacity>
                                )}
                                ItemSeparatorComponent={() => <View style={styles.separator} />}
                            />
                        )}
                        <TouchableOpacity
                            style={styles.cancelBtn}
                            onPress={() => setLangModalVisible(false)}
                        >
                            <Text style={styles.cancelText}>{t('取消')}</Text>
                        </TouchableOpacity>
                    </Pressable>
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    container: {
        padding: Spacing.lg,
        paddingBottom: Spacing['4xl'],
    },
    header: {
        alignItems: 'center',
        paddingVertical: Spacing['3xl'],
    },
    title: {
        fontSize: FontSize['4xl'],
        fontWeight: FontWeight.bold,
        color: Colors.textPrimary,
    },
    subtitle: {
        marginTop: Spacing.xs,
        fontSize: FontSize.md,
        color: Colors.textSecondary,
    },
    card: {
        backgroundColor: Colors.white,
        borderRadius: 12,
        padding: Spacing.lg,
        marginBottom: Spacing.md,
        boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.06)',
    },
    cardTitle: {
        fontSize: FontSize.lg,
        fontWeight: FontWeight.semibold,
        color: Colors.textPrimary,
        marginBottom: Spacing.sm,
    },
    cardText: {
        fontSize: FontSize.md,
        color: Colors.textSecondary,
    },
    codeText: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        fontFamily: 'monospace',
        lineHeight: 22,
    },
    buttonGroup: {
        gap: Spacing.sm,
    },
    gradientSample: {
        minHeight: 48,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.lg,
    },
    gradientSampleText: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.semibold,
        color: Colors.white,
    },
    langBtn: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: Colors.background,
        marginRight: 4,
    },
    langBtnText: {
        fontSize: FontSize.sm,
        color: Colors.textPrimary,
        fontWeight: FontWeight.semibold,
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    langModal: {
        backgroundColor: Colors.white,
        borderRadius: 16,
        width: 280,
        paddingVertical: Spacing.lg,
        boxShadow: '0px 8px 16px rgba(0, 0, 0, 0.15)',
    },
    langModalTitle: {
        fontSize: FontSize.lg,
        fontWeight: FontWeight.bold,
        color: Colors.textPrimary,
        textAlign: 'center',
        paddingHorizontal: Spacing.lg,
        marginBottom: Spacing.md,
    },
    langEmptyText: {
        fontSize: FontSize.md,
        color: Colors.textSecondary,
        textAlign: 'center',
        paddingVertical: Spacing.lg,
    },
    langItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.lg,
    },
    langItemActive: {
        backgroundColor: '#F0F4FF',
    },
    langItemText: {
        fontSize: FontSize.md,
        color: Colors.textPrimary,
    },
    langItemTextActive: {
        fontWeight: FontWeight.semibold,
        color: '#4A6FFF',
    },
    checkmark: {
        fontSize: 16,
    },
    separator: {
        height: 1,
        backgroundColor: Colors.background,
    },
    cancelBtn: {
        marginTop: Spacing.md,
        paddingVertical: Spacing.sm,
        marginHorizontal: Spacing.lg,
        borderRadius: 10,
        backgroundColor: Colors.background,
        alignItems: 'center',
    },
    cancelText: {
        fontSize: FontSize.md,
        color: Colors.textSecondary,
        fontWeight: FontWeight.semibold,
    },
});
