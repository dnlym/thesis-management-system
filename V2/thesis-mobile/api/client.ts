import axios from 'axios';
import { useAuthStore } from '../store/auth';

// For Android Emulator, use 10.0.2.2 instead of localhost
// Change this to your machine's local IP for physical devices
const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000';

export const api = axios.create({
    baseURL: `${BASE_URL}/api`,
});

// Attach Authorization header if token exists
api.interceptors.request.use((config) => {
    const { token } = useAuthStore.getState();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Basic response handling
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const status = error?.response?.status;

        if (status === 401) {
            // Basic logout on unauthorized for now
            // Refresh token logic can be ported later if needed
            useAuthStore.getState().logout();
        }

        return Promise.reject(error);
    }
);

export default api;
