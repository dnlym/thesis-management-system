import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export type StatusType = 'NOT_STARTED' | 'DRAFT' | 'SUBMITTED' | 'LOCKED';

interface StatusBadgeProps {
    status: StatusType;
}

const STATUS_CONFIG: Record<StatusType, { bg: string; text: string; border: string; label: string }> = {
    NOT_STARTED: { bg: '#fff7ed', text: '#ea580c', border: '#fed7aa', label: 'Chưa chấm' },
    DRAFT: { bg: '#fefce8', text: '#ca8a04', border: '#fef08a', label: 'Nháp' },
    SUBMITTED: { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0', label: 'Đã nộp' },
    LOCKED: { bg: '#f9fafb', text: '#6b7280', border: '#e5e7eb', label: 'Đã khóa' },
};

export const StatusBadge = ({ status }: StatusBadgeProps) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.NOT_STARTED;
    return (
        <View style={[styles.badge, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
            <Text style={[styles.badgeText, { color: cfg.text }]}>{cfg.label}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
    badgeText: { fontSize: 10, fontWeight: '600' },
});
