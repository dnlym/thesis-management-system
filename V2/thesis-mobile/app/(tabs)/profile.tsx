import React from 'react';
import {
    View, Text, TouchableOpacity, ScrollView,
    StyleSheet, SafeAreaView, StatusBar
} from 'react-native';
import { useAuthStore } from '@/store/auth';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { LogOut, Settings, Info, User, ChevronRight } from 'lucide-react-native';
import { ActivityIndicator } from 'react-native';

const BLUE = '#2563eb';

export default function ProfileScreen() {
    const { user } = useAuthStore();
    const { logout, isLoggingOut } = useAuth();
    const router = useRouter();

    const handleLogout = () => {
        logout(undefined, {
            onSuccess: () => {
                router.replace('/login');
            }
        });
    };

    const MENU_ITEMS = [
        { icon: Settings, label: 'Cài đặt tài khoản', color: '#6b7280', onPress: () => { } },
        { icon: Info, label: 'Về ứng dụng', color: '#6b7280', onPress: () => { } },
    ];

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
            <StatusBar barStyle="dark-content" />
            <ScrollView>
                {/* Modern Profile Header */}
                <View style={styles.header}>
                    <View style={styles.avatarContainer}>
                        <View style={styles.avatarCircle}>
                            <User size={40} color={BLUE} />
                        </View>
                        <View style={styles.editAvatarBtn}>
                            <Settings size={14} color="#fff" />
                        </View>
                    </View>
                    <Text style={styles.userName}>{user?.full_name || 'TS. Nguyễn Văn A'}</Text>
                    <View style={styles.roleTag}>
                        <Text style={styles.roleTagText}>
                            {user?.role === 'LECTURER' ? 'GIẢNG VIÊN' : user?.role || 'GIẢNG VIÊN'}
                        </Text>
                    </View>
                </View>

                {/* Menu */}
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Tài khoản</Text>
                    <View style={styles.card}>
                        {MENU_ITEMS.map((item, i) => {
                            const Icon = item.icon;
                            return (
                                <TouchableOpacity
                                    key={i}
                                    style={[styles.menuItem, i < MENU_ITEMS.length - 1 && styles.menuBorder]}
                                    onPress={item.onPress}
                                >
                                    <Icon size={20} color={item.color} />
                                    <Text style={styles.menuLabel}>{item.label}</Text>
                                    <ChevronRight size={16} color="#d1d5db" />
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                {/* Logout */}
                <View style={[styles.section, { marginTop: 8 }]}>
                    <View style={styles.card}>
                        <TouchableOpacity
                            style={[styles.menuItem, isLoggingOut && { opacity: 0.5 }]}
                            onPress={handleLogout}
                            disabled={isLoggingOut}
                        >
                            {isLoggingOut ? (
                                <ActivityIndicator size="small" color="#ef4444" style={{ marginRight: 12 }} />
                            ) : (
                                <LogOut size={20} color="#ef4444" />
                            )}
                            <Text style={[styles.menuLabel, { color: '#ef4444' }]}>
                                {isLoggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Version */}
                <View style={{ alignItems: 'center', marginTop: 32 }}>
                    <Text style={{ fontSize: 11, color: '#d1d5db' }}>Thesis Grading v1.0.0</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    header: { backgroundColor: '#fff', paddingVertical: 40, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    avatarContainer: { position: 'relative', marginBottom: 16 },
    avatarCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: '#f8fafc' },
    editAvatarBtn: { position: 'absolute', bottom: 0, right: 0, backgroundColor: BLUE, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
    userName: { fontSize: 22, fontWeight: '800', color: '#111827' },
    roleTag: { backgroundColor: '#f1f5f9', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginTop: 8 },
    roleTagText: { fontSize: 10, fontWeight: '800', color: '#64748b', letterSpacing: 0.5 },
    section: { marginHorizontal: 16, marginTop: 20 },
    sectionLabel: { fontSize: 11, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
    card: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#f1f5f9', overflow: 'hidden' },
    menuItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 15 },
    menuBorder: { borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    menuLabel: { flex: 1, marginLeft: 12, fontSize: 14, color: '#374151', fontWeight: '500' },
});
