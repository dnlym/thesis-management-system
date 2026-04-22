import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export type SyncStatus = 'PENDING' | 'SYNCING' | 'SUCCESS' | 'ERROR';

interface SyncOverlayProps {
    status: SyncStatus;
    pendingCount: number;
    onRetry?: () => void;
}

const CONFIG: Record<SyncStatus, { bg: string; text: string; label: (n: number) => string }> = {
    PENDING: { bg: '#f97316', text: '#fff', label: (n) => `${n} điểm đang chờ đồng bộ` },
    SYNCING: { bg: '#2563eb', text: '#fff', label: () => 'Đang đồng bộ dữ liệu...' },
    SUCCESS: { bg: '#16a34a', text: '#fff', label: () => 'Đã đồng bộ tất cả' },
    ERROR: { bg: '#dc2626', text: '#fff', label: () => 'Lỗi đồng bộ. Thử lại.' },
};

export const SyncOverlay = ({ status, pendingCount, onRetry }: SyncOverlayProps) => {
    if (status === 'SUCCESS' && pendingCount === 0) return null;

    const cfg = CONFIG[status];
    return (
        <View style={[styles.bar, { backgroundColor: cfg.bg }]}>
            <Text style={[styles.text, { color: cfg.text }]}>{cfg.label(pendingCount)}</Text>
            {status === 'ERROR' && onRetry && (
                <TouchableOpacity onPress={onRetry} style={styles.retryBtn}>
                    <Text style={styles.retryText}>Thử lại</Text>
                </TouchableOpacity>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    bar: {
        position: 'absolute', bottom: 72, left: 16, right: 16,
        borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
        flexDirection: 'row', alignItems: 'center',
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15, shadowRadius: 10, elevation: 6, zIndex: 99,
    },
    text: { flex: 1, fontSize: 13, fontWeight: '600' },
    retryBtn: { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4 },
    retryText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
