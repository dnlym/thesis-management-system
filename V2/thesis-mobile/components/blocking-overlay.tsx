import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Lock } from 'lucide-react-native';

interface BlockingOverlayProps {
    visible: boolean;
    message: string;
}

export const BlockingOverlay = ({ visible, message }: BlockingOverlayProps) => {
    if (!visible) return null;

    return (
        <View style={styles.overlay}>
            <View style={styles.card}>
                <View style={styles.iconWrap}>
                    <Lock size={32} color="#ef4444" />
                </View>
                <Text style={styles.title}>Chưa thể chấm điểm</Text>
                <Text style={styles.message}>{message}</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    overlay: {
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(255,255,255,0.88)',
        zIndex: 100, alignItems: 'center', justifyContent: 'center',
        paddingHorizontal: 24,
    },
    card: {
        backgroundColor: '#fff', borderRadius: 20, padding: 28,
        alignItems: 'center',
        shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12, shadowRadius: 20, elevation: 10,
        borderWidth: 1, borderColor: '#f1f5f9', width: '100%',
    },
    iconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#fef2f2', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    title: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 8, textAlign: 'center' },
    message: { fontSize: 13, color: '#6b7280', textAlign: 'center', lineHeight: 20 },
});
