// frontend/src/api/axiosClient.js
import axios from 'axios';

// Vite uses import.meta.env for environment variables
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const axiosClient = axios.create({
    baseURL: BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// The Interceptor: Runs before every request is sent
axiosClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('access_token');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);
