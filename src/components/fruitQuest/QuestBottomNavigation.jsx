import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import useTranslation from '@/hooks/useTranslation';
import HomeActiveIcon from '@/assets/fruit-quest/tabs/home-active.svg';
import HomeInactiveIcon from '@/assets/fruit-quest/tabs/home-inactive.svg';
import GardenActiveIcon from '@/assets/fruit-quest/tabs/garden-active.svg';
import GardenInactiveIcon from '@/assets/fruit-quest/tabs/garden-inactive.svg';
import CollectionActiveIcon from '@/assets/fruit-quest/tabs/collection-active.svg';
import CollectionInactiveIcon from '@/assets/fruit-quest/tabs/collection-inactive.svg';
import SettingsActiveIcon from '@/assets/fruit-quest/tabs/settings-active.svg';
import SettingsInactiveIcon from '@/assets/fruit-quest/tabs/settings-inactive.svg';

const TAB_ROUTES = {
    home: '/home',
    garden: '/garden',
    collection: '/collection',
    settings: '/settings',
};

export default function QuestBottomNavigation({ activeTab }) {
    const router = useRouter();
    const { t } = useTranslation();
    const tabs = [
        {
            id: 'home',
            label: t('首页'),
            inactiveIcon: HomeInactiveIcon,
            activeIcon: HomeActiveIcon,
            iconWidth: 24,
            iconHeight: 21,
        },
        {
            id: 'garden',
            label: t('果园'),
            inactiveIcon: GardenInactiveIcon,
            activeIcon: GardenActiveIcon,
            iconWidth: 20.9491,
            iconHeight: 24,
        },
        {
            id: 'collection',
            label: t('收获（底部导航）'),
            inactiveIcon: CollectionInactiveIcon,
            activeIcon: CollectionActiveIcon,
            iconWidth: 30,
            iconHeight: 30,
        },
        {
            id: 'settings',
            label: t('设置'),
            inactiveIcon: SettingsInactiveIcon,
            activeIcon: SettingsActiveIcon,
            iconWidth: 24,
            iconHeight: 24,
        },
    ];

    const navigateToQuestTab = useCallback((tabId) => {
        if (tabId === activeTab) {
            return;
        }
        router.replace(TAB_ROUTES[tabId]);
    }, [activeTab, router]);

    return (
        <View style={styles.navigation}>
            {tabs.map((tab) => {
                const selected = tab.id === activeTab;
                const TabIcon = selected ? tab.activeIcon : tab.inactiveIcon;
                return (
                    <Pressable
                        key={tab.id}
                        style={styles.tab}
                        onPress={() => navigateToQuestTab(tab.id)}
                    >
                        <View style={styles.iconSlot}>
                            <TabIcon width={tab.iconWidth} height={tab.iconHeight} />
                        </View>
                        <Text style={[styles.label, selected && styles.selectedLabel]}>{tab.label}</Text>
                    </Pressable>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    navigation: {
        height: 76,
        flexDirection: 'row',
        alignItems: 'center',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        backgroundColor: '#070513',
        boxShadow: '0px -4px 2px rgba(0, 0, 0, 0.25)',
    },
    tab: {
        flex: 1,
        height: 50,
        alignItems: 'center',
        justifyContent: 'flex-start',
    },
    iconSlot: {
        width: 30,
        height: 30,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: -0.5,
    },
    label: {
        marginTop: 4,
        color: '#C2B7E4',
        fontSize: 12,
        fontWeight: '400',
        lineHeight: 17,
    },
    selectedLabel: {
        color: '#08C8FF',
    },
});
