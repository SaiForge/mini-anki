// frontend/src/context/DataContext.jsx
import { createContext, useState, useEffect, useCallback, useContext } from 'react';
import { axiosClient } from '../api/axiosClient';
import { AuthContext } from './AuthContext';

export const DataContext = createContext();

export const DataProvider = ({ children }) => {
    const { isAuthenticated } = useContext(AuthContext);

    const [decks, setDecks] = useState([]);
    const [userProfile, setUserProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Fetch decks and profile once when authenticated
    useEffect(() => {
        if (!isAuthenticated) {
            // Clear cache on logout
            setDecks([]);
            setUserProfile(null);
            setLoading(false);
            setError('');
            return;
        }

        let cancelled = false;

        const fetchAll = async () => {
            setLoading(true);
            setError('');

            try {
                const [decksRes, profileRes] = await Promise.allSettled([
                    axiosClient.get('/api/decks/'),
                    axiosClient.get('/api/auth/me'),
                ]);

                if (cancelled) return;

                if (decksRes.status === 'fulfilled') {
                    setDecks(decksRes.value.data || []);
                } else {
                    setError(decksRes.reason?.response?.data?.detail || 'Could not load decks right now.');
                }

                if (profileRes.status === 'fulfilled') {
                    setUserProfile(profileRes.value.data);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        fetchAll();

        return () => {
            cancelled = true;
        };
    }, [isAuthenticated]);

    // Force re-fetch decks (rarely needed)
    const refreshDecks = useCallback(async () => {
        try {
            const response = await axiosClient.get('/api/decks/');
            setDecks(response.data || []);
        } catch (err) {
            console.error('Failed to refresh decks', err);
        }
    }, []);

    // Refresh user profile (e.g. after a study session updates the streak)
    const refreshUserProfile = useCallback(async () => {
        try {
            const response = await axiosClient.get('/api/auth/me');
            setUserProfile(response.data);
        } catch (err) {
            console.error('Failed to refresh user profile', err);
        }
    }, []);

    // Add a new deck — makes API call and updates cache in-place
    const addDeck = useCallback(async (title) => {
        const response = await axiosClient.post('/api/decks/', { title });
        setDecks((prev) => [...prev, response.data]);
        return response.data;
    }, []);

    // Delete a deck — makes API call and removes from cache
    const deleteDeck = useCallback(async (deckId) => {
        await axiosClient.delete(`/api/decks/${deckId}`);
        setDecks((prev) => prev.filter((deck) => deck.deck_id !== deckId));
    }, []);

    // Add a card to a deck — API call only, no deck list change needed
    const addCard = useCallback(async (deckId, frontText, backText) => {
        const response = await axiosClient.post(`/api/decks/${deckId}/cards`, {
            front_text: frontText,
            back_text: backText,
        });
        return response.data;
    }, []);

    return (
        <DataContext.Provider
            value={{
                decks,
                userProfile,
                loading,
                error,
                addDeck,
                deleteDeck,
                addCard,
                refreshDecks,
                refreshUserProfile,
            }}
        >
            {children}
        </DataContext.Provider>
    );
};
