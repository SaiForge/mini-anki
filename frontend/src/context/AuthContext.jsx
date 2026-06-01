// frontend/src/context/AuthContext.jsx
import { createContext, useState, useEffect } from 'react';
import { axiosClient } from '../api/axiosClient';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check if token exists on load
        const token = localStorage.getItem('access_token');
        if (token) {
            setIsAuthenticated(true);
        }
        setLoading(false);
    }, []);

    const login = async (email, password) => {
        const response = await axiosClient.post('/api/auth/login', { email, password });
        const token = response.data.access_token;
        localStorage.setItem('access_token', token);
        setIsAuthenticated(true);
        return response.data;
    };

    const register = async (email, password) => {
        const response = await axiosClient.post('/api/auth/register', { email, password });
        return response.data;
    };

    const logout = () => {
        localStorage.removeItem('access_token');
        setIsAuthenticated(false);
    };

    return (
        <AuthContext.Provider value={{ isAuthenticated, login, register, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};
