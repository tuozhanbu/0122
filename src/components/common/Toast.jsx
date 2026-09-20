import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';

export default function Toast({ message, bottom, top }) {
    const opacityRef = useRef(new Animated.Value(0));

    useEffect(() => {
        if (!message) {
            opacityRef.current.setValue(0);
            return;
        }

        Animated.timing(opacityRef.current, {
            toValue: 1,
            duration: 160,
            useNativeDriver: true,
        }).start();
    }, [message]);

    if (!message) {
        return null;
    }

    return (
        <Animated.View
            style={[styles.toast, {
                pointerEvents: 'none',
                bottom,
                top,
                opacity: opacityRef.current,
            }]}
        >
            <Text style={styles.toastText}>{message}</Text>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    toast: {
        position: 'absolute',
        left: 24,
        right: 24,
        minHeight: 44,
        borderRadius: 22,
        paddingHorizontal: 18,
        paddingVertical: 10,
        backgroundColor: 'rgba(0, 0, 0, 0.78)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 30,
    },
    toastText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '600',
        textAlign: 'center',
    },
});
