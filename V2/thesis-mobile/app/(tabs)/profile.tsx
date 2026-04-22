import React from 'react';
import {
    View, Text, TouchableOpacity, ScrollView,
    StyleSheet, SafeAreaView
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
            <ScrollView>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.avatarCircle}>
                        <User size={38} color="#fff" />
                    </View>
                    <Text style={styles.userName}>{user?.full_name || 'TS. Nguyễn Văn A'}</Text>
                    <Text style={styles.userRole}>
                        {user?.role === 'LECTURER' ? 'Giảng viên' : user?.role || 'Giảng viên'}
                    </Text>
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
    header: { backgroundColor: BLUE, paddingTop: 32, paddingBottom: 40, alignItems: 'center' },
    avatarCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', marginBottom: 12, borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)' },
    userName: { fontSize: 20, fontWeight: '700', color: '#fff' },
    userRole: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
    section: { marginHorizontal: 16, marginTop: 20 },
    sectionLabel: { fontSize: 11, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
    card: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#f1f5f9', overflow: 'hidden' },
    menuItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 15 },
    menuBorder: { borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    menuLabel: { flex: 1, marginLeft: 12, fontSize: 14, color: '#374151', fontWeight: '500' },
});
