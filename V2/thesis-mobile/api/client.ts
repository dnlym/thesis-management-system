import axios from 'axios';
import { useAuthStore } from '@/store/auth';

// Base URL: adjust via Expo env if available; fallback to backend localhost:3000
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

console.log('[API Diagnostic] BASE_URL:', BASE_URL);
console.log('[API Diagnostic] EXPO_PUBLIC_API_URL:', process.env.EXPO_PUBLIC_API_URL);

export const api = axios.create({
    baseURL: `${BASE_URL}/api`,
    withCredentials: true,
});

// Attach Authorization header if token exists
api.interceptors.request.use((config) => {
    // API Call Logging
    const method = config.method?.toUpperCase();
    const url = config.url;
    const data = config.data ? JSON.stringify(config.data).substring(0, 500) : 'None';

    console.log(`\n[🚀 API Request] ${method} ${url}`);
    if (config.data) console.log(`[Payload]: ${data}${data.length >= 500 ? '...' : ''}`);

    const { token } = useAuthStore.getState();
    if (token) {
        const headers: any = config.headers;
        if (headers && typeof headers.set === 'function') {
            headers.set('Authorization', `Bearer ${token}`);
        } else {
            config.headers = {
                ...(config.headers as any),
                Authorization: `Bearer ${token}`,
            } as any;
        }
    }
    return config;
});

// Handle 401 by attempting refresh token, then retry once
let isRefreshing = false;
let pendingRequests: Array<(token: string | null) => void> = [];

function subscribeTokenRefresh(cb: (token: string | null) => void) {
    pendingRequests.push(cb);
}

function onRefreshed(newToken: string | null) {
    pendingRequests.forEach((cb) => cb(newToken));
    pendingRequests = [];
}

api.interceptors.response.use(
    (response) => {
        console.log(`[✅ API Success] ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url}`);
        return response;
    },
    async (error) => {
        const status = error?.response?.status;
        const method = error?.config?.method?.toUpperCase();
        const url = error?.config?.url;
        const errorData = error?.response?.data;
        const originalRequest = error.config;

        // Handle 401 Refresh Token Logic
        if (status === 401 && !originalRequest._retry) {
            // Don't attempt to refresh if the failed request was login or refresh-token attempt
            if (url?.includes('/auth/login') || url?.includes('/auth/refresh-token')) {
                return Promise.reject(error);
            }

            if (isRefreshing) {
                console.log(`[⏳ API Queue] ${method} ${url} (waiting for token refresh)`);
                return new Promise((resolve, reject) => {
                    subscribeTokenRefresh((token) => {
                        if (token) {
                            const hdrs: any = originalRequest.headers;
                            if (hdrs && typeof hdrs.set === 'function') {
                                hdrs.set('Authorization', `Bearer ${token}`);
                            } else {
                                originalRequest.headers = {
                                    ...(originalRequest.headers as any),
                                    Authorization: `Bearer ${token}`,
                                } as any;
                            }
                            resolve(api(originalRequest));
                        } else {
                            reject(error);
                        }
                    });
                });
            }

            console.warn(`\n[🔑 Token Expired] 401 ${method} ${url} -> Attempting refresh...`);
            originalRequest._retry = true;
            isRefreshing = true;

            try {
                const { refreshToken } = useAuthStore.getState();

                if (!refreshToken) {
                    throw new Error('No refresh token available');
                }

                // Call refresh endpoint directly using api instance
                const refreshResponse = await api.post('/auth/refresh-token', { refreshToken });
                const newAccessToken: string | undefined = refreshResponse?.data?.data?.accessToken;
                const { login, user, isAuthenticated } = useAuthStore.getState();

                if (newAccessToken) {
                    if (isAuthenticated && user && refreshToken) {
                        login(user, newAccessToken, refreshToken);
                    } else if (refreshToken) {
                        login((user as any) || null, newAccessToken, refreshToken);
                    }

                    console.log('[✨ Token Refreshed] Retrying pending requests...');
                    onRefreshed(newAccessToken);

                    const hdrs: any = originalRequest.headers;
                    if (hdrs && typeof hdrs.set === 'function') {
                        hdrs.set('Authorization', `Bearer ${newAccessToken}`);
                    } else {
                        originalRequest.headers = {
                            ...(originalRequest.headers as any),
                            Authorization: `Bearer ${newAccessToken}`,
                        } as any;
                    }
                    return api(originalRequest);
                }

                onRefreshed(null);
                return Promise.reject(error);
            } catch (e) {
                onRefreshed(null);
                const { logout } = useAuthStore.getState();
                logout();
                console.error('[🚫 Refresh Failed] Session expired, logging out.');
                return Promise.reject(e);
            } finally {
                isRefreshing = false;
            }
        }

        // Only log errors if they are NOT 401s that were just handled
        console.error(`\n[❌ API Error] ${status || 'Network Error'} ${method} ${url}`);
        if (errorData) {
            console.error('[Error Details]:', JSON.stringify(errorData, null, 2));
        } else {
            console.error('[Error Message]:', error.message);
        }

        if (status === 403) {
            console.error('Access Forbidden:', error.response?.data?.message || 'You do not have permission to access this resource.');
        }

        if (status === 500) {
            console.error('Server Error:', error.response?.data?.message || 'Internal Server Error');
        }

        return Promise.reject(error);
    }
);

export default api;
