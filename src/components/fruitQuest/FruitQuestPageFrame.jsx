import React from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import QuestBottomNavigation from '@/components/fruitQuest/QuestBottomNavigation';
import QuestPlayerStatus from '@/components/fruitQuest/QuestPlayerStatus';
import useFruitQuestPageLayout from '@/hooks/useFruitQuestPageLayout';

export default function FruitQuestPageFrame({ activeTab, children }) {
    const { standardContentHorizontalInset } = useFruitQuestPageLayout();

    return (
        <View style={styles.page}>
            <StatusBar style="light" translucent backgroundColor="transparent" />
            <LinearGradient
                colors={['#140628', '#400C69', '#0F2B52', '#160728']}
                locations={[0.1, 0.28, 0.65, 0.79]}
                start={{ x: 0.14, y: 0 }}
                end={{ x: 0.72, y: 1 }}
                style={StyleSheet.absoluteFill}
            />
            <SafeAreaView style={styles.safeContent} edges={['top', 'left', 'right']}>
                <View style={[styles.playerStatusArea, { paddingHorizontal: standardContentHorizontalInset }]}>
                    <QuestPlayerStatus />
                </View>
                <View style={styles.content}>{children}</View>
            </SafeAreaView>
            <SafeAreaView style={styles.bottomSafeArea} edges={['bottom']}>
                <QuestBottomNavigation activeTab={activeTab} />
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    page: {
        flex: 1,
    },
    safeContent: {
        flex: 1,
    },
    playerStatusArea: {
    },
    content: {
        flex: 1,
        minHeight: 0,
    },
    bottomSafeArea: {
        backgroundColor: '#070513',
    },
});
