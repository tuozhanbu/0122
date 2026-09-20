import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { getFruitQuestFruit } from '@/store/fruitQuestCatalog';

export default function FruitQuestFruitImage({ fruitId, displaySize }) {
    const fruit = getFruitQuestFruit(fruitId);

    return (
        <View style={[styles.container, { width: displaySize, height: displaySize }]}>
            <Image
                source={fruit.image}
                style={[styles.image, { width: displaySize, height: displaySize }]}
                resizeMode="contain"
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    image: {
        maxWidth: '100%',
        maxHeight: '100%',
    },
});
