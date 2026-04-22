import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export type RoleType = 'SUPERVISOR' | 'REVIEWER' | 'COMMITTEE';

interface RoleBadgeProps {
    role: RoleType;
    label?: string;
}

const ROLE_CONFIG: Record<RoleType, { bg: string; text: string; border: string; label: string }> = {
    SUPERVISOR: { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe', label: 'GVHD' },
    REVIEWER: { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa', label: 'GVPB' },
    COMMITTEE: { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0', label: 'Hội đồng' },
};

export const RoleBadge = ({ role, label }: RoleBadgeProps) => {
    const cfg = ROLE_CONFIG[role] || ROLE_CONFIG.SUPERVISOR;
    return (
        <View style={[styles.badge, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
            <Text style={[styles.badgeText, { color: cfg.text }]}>{label || cfg.label}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
    badgeText: { fontSize: 10, fontWeight: '700' },
});
