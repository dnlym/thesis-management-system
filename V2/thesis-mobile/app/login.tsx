import React from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    KeyboardAvoidingView, Platform, ScrollView,
    StyleSheet, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { Eye, EyeOff, Lock, User, GraduationCap, Shield } from 'lucide-react-native';

const BLUE = '#2563eb';

export default function LoginScreen() {
    const router = useRouter();
    const { login, isLoggingIn } = useAuth();
    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [showPassword, setShowPassword] = React.useState(false);
    const [rememberMe, setRememberMe] = React.useState(false);

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Thiếu thông tin', 'Vui lòng nhập tài khoản và mật khẩu.');
            return;
        }

        login({ email, password }, {
            onSuccess: () => {
                router.replace('/(tabs)');
            }
        });
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1, backgroundColor: '#fff' }}
        >
            <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
                <SafeAreaView style={{ flex: 1 }}>
                    <View style={styles.container}>

                        {/* Logo */}
                        <View style={styles.logoWrap}>
                            <View style={styles.logoBox}>
                                <GraduationCap size={44} color="#fff" />
                            </View>
                            <Text style={styles.appName}>THESIS GRADING</Text>
                            <Text style={styles.appSub}>Hệ thống chấm điểm luận văn</Text>
                        </View>

                        {/* Form */}
                        <View style={styles.form}>
                            <Text style={styles.fieldLabel}>Tài khoản</Text>
                            <View style={styles.inputRow}>
                                <User size={18} color="#9ca3af" />
                                <TextInput
                                    style={styles.inputText}
                                    placeholder="Nhập tài khoản"
                                    placeholderTextColor="#cbd5e1"
                                    value={email}
                                    onChangeText={setEmail}
                                    autoCapitalize="none"
                                />
                            </View>

                            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Mật khẩu</Text>
                            <View style={styles.inputRow}>
                                <Lock size={18} color="#9ca3af" />
                                <TextInput
                                    style={styles.inputText}
                                    placeholder="Nhập mật khẩu"
                                    placeholderTextColor="#cbd5e1"
                                    secureTextEntry={!showPassword}
                                    value={password}
                                    onChangeText={setPassword}
                                />
                                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                    {showPassword
                                        ? <EyeOff size={18} color="#9ca3af" />
                                        : <Eye size={18} color="#9ca3af" />}
                                </TouchableOpacity>
                            </View>

                            {/* Remember me */}
                            <TouchableOpacity
                                style={styles.rememberRow}
                                onPress={() => setRememberMe(!rememberMe)}
                            >
                                <View style={[styles.checkbox, rememberMe && styles.checkboxActive]}>
                                    {rememberMe && <View style={styles.checkDot} />}
                                </View>
                                <Text style={styles.rememberText}>Ghi nhớ đăng nhập</Text>
                            </TouchableOpacity>

                            {/* Login button */}
                            <TouchableOpacity
                                style={[styles.loginBtn, isLoggingIn && { opacity: 0.7 }]}
                                onPress={handleLogin}
                                disabled={isLoggingIn}
                            >
                                <Text style={styles.loginBtnText}>
                                    {isLoggingIn ? 'Đang xử lý...' : 'Đăng nhập'}
                                </Text>
                            </TouchableOpacity>

                            {/* Divider */}
                            <View style={styles.dividerRow}>
                                <View style={styles.dividerLine} />
                                <Text style={styles.dividerText}>hoặc</Text>
                                <View style={styles.dividerLine} />
                            </View>

                            {/* SSO */}
                            <TouchableOpacity style={styles.ssoBtn}>
                                <Shield size={18} color={BLUE} />
                                <Text style={styles.ssoBtnText}>Đăng nhập bằng SSO</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={{ marginTop: 'auto', alignItems: 'center', paddingTop: 24 }}>
                            <Text style={styles.version}>Phiên bản 1.0.0</Text>
                        </View>
                    </View>
                </SafeAreaView>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, paddingHorizontal: 28, paddingTop: 40, paddingBottom: 24 },
    logoWrap: { alignItems: 'center', marginBottom: 40 },
    logoBox: { width: 72, height: 72, backgroundColor: BLUE, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 14, shadowColor: BLUE, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6 },
    appName: { fontSize: 22, fontWeight: '900', color: '#111827', letterSpacing: 1 },
    appSub: { fontSize: 13, color: '#9ca3af', marginTop: 4 },
    form: {},
    fieldLabel: { fontSize: 12, fontWeight: '700', color: '#374151', marginBottom: 8 },
    inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13 },
    inputText: { flex: 1, marginLeft: 10, fontSize: 14, color: '#111827' },
    rememberRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, marginBottom: 4 },
    checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: '#d1d5db', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
    checkboxActive: { backgroundColor: BLUE, borderColor: BLUE },
    checkDot: { width: 8, height: 8, backgroundColor: '#fff', borderRadius: 2 },
    rememberText: { marginLeft: 8, fontSize: 13, color: '#6b7280' },
    loginBtn: { backgroundColor: BLUE, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 24, shadowColor: BLUE, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
    loginBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
    dividerLine: { flex: 1, height: 1, backgroundColor: '#f1f5f9' },
    dividerText: { marginHorizontal: 12, fontSize: 11, color: '#d1d5db', fontWeight: '700', textTransform: 'uppercase' },
    ssoBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingVertical: 14, backgroundColor: '#fff' },
    ssoBtnText: { marginLeft: 8, fontSize: 14, fontWeight: '600', color: '#374151' },
    version: { fontSize: 11, color: '#d1d5db' },
});
