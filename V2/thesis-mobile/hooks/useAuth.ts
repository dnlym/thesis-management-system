import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AuthApi } from '@/api/auth';
import { useAuthStore } from '@/store/auth';
import { Alert } from 'react-native';

export function useAuth() {
    const { login: setAuth, logout: clearAuth } = useAuthStore();
    const queryClient = useQueryClient();

    const loginMutation = useMutation({
        mutationFn: ({ email, password }: any) => AuthApi.login(email, password),
        onSuccess: (response: any) => {
            const { accessToken, refreshToken, user } = response.data;
            // Map backend user to store user if fields differ
            setAuth({
                id: user.id,
                full_name: user.fullName || user.full_name,
                email: user.email,
                role: user.role as any,
                departmentId: user.departmentId
            }, accessToken, refreshToken);
        },
        onError: (error: any) => {
            const message = error.response?.data?.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại.';
            Alert.alert('Lỗi', message);
        }
    });

    const logoutMutation = useMutation({
        mutationFn: () => AuthApi.logout(),
        onSettled: () => {
            clearAuth();
            queryClient.clear();
        }
    });

    return {
        login: loginMutation.mutate,
        isLoggingIn: loginMutation.isPending,
        logout: logoutMutation.mutate,
        isLoggingOut: logoutMutation.isPending
    };
}
