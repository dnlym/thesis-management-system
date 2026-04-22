import axios from 'axios';
import { useAuthStore } from '@/store/auth';

// Base URL: adjust via Expo env if available; fallback to backend localhost:3000
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export const api = axios.create({
    baseURL: `${BASE_URL}/api`,
    withCredentials: true,
});

// Attach Authorization header if token exists
api.interceptors.request.use((config) => {
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
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        const status = error?.response?.status;

        if (status === 401 && !originalRequest._retry) {
            // Don't attempt to refresh if the failed request was a login attempt
            if (originalRequest.url?.includes('/auth/login')) {
                return Promise.reject(error);
            }

            if (isRefreshing) {
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

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                // Call refresh endpoint to rotate cookie and get new access token
                const { refreshToken } = useAuthStore.getState();

                if (!refreshToken) {
                    throw new Error('No refresh token available');
                }

                const refreshResponse = await api.post('/auth/refresh-token', { refreshToken });
                const newAccessToken: string | undefined = refreshResponse?.data?.data?.accessToken;
                const { login, user, isAuthenticated } = useAuthStore.getState();

                if (newAccessToken) {
                    // keep existing user if present
                    if (isAuthenticated && user && refreshToken) {
                        login(user, newAccessToken, refreshToken);
                    } else if (refreshToken) {
                        // no user available; set token only
                        login((user as any) || null, newAccessToken, refreshToken);
                    }

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
                // logout on failed refresh
                const { logout } = useAuthStore.getState();
                logout();
                return Promise.reject(e);
            } finally {
                isRefreshing = false;
            }
        }

        if (status === 403) {
            console.error('Access Forbidden:', error.response?.data?.message || 'You do not have permission to access this resource.');
            // Optionally trigger a global notification or redirect here
        }

        if (status === 500) {
            console.error('Server Error:', error.response?.data?.message || 'Internal Server Error');
            // Optionally trigger a global notification here
        }

        return Promise.reject(error);
    }
);

export default api;
