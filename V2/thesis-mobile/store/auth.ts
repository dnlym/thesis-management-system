import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface User {
    id: string;
    full_name: string;
    email: string;
    role: 'ADMIN' | 'HEAD' | 'LECTURER' | 'STUDENT' | 'COORDINATOR';
    avatar_url?: string | null;
    student_code?: string;
    departmentId?: string;
}

interface AuthState {
    user: User | null;
    token: string | null;
    refreshToken: string | null;
    isAuthenticated: boolean;
    login: (user: User, token: string, refreshToken: string) => void;
    logout: () => void;
    updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            token: null,
            refreshToken: null,
            isAuthenticated: false,

            login: (user: User, token: string, refreshToken: string) => {
                set({ user, token, refreshToken, isAuthenticated: true });
            },

            logout: () => {
                set({ user: null, token: null, refreshToken: null, isAuthenticated: false });
            },

            updateUser: (userData: Partial<User>) => {
                const currentUser = get().user;
                if (currentUser) {
                    set({ user: { ...currentUser, ...userData } });
                }
            },
        }),
        {
            name: 'auth-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
