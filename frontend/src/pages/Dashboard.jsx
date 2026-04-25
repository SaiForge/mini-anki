import { useContext, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { axiosClient } from '../api/axiosClient';

const LAST_USED_DECK_KEY = 'mini_anki_last_used_deck_id';

export default function Dashboard() {
    const navigate = useNavigate();
    const location = useLocation();
    const { logout } = useContext(AuthContext);

    const [decks, setDecks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedDeckId, setSelectedDeckId] = useState('');
    const [frontText, setFrontText] = useState('');
    const [backText, setBackText] = useState('');
    const [creatingCard, setCreatingCard] = useState(false);
    const [cardFormError, setCardFormError] = useState('');
    const [isAddCardModalOpen, setIsAddCardModalOpen] = useState(false);
    const [isDeleteDeckModalOpen, setIsDeleteDeckModalOpen] = useState(false);
    const [deckToDelete, setDeckToDelete] = useState(null);
    const [deletingDeck, setDeletingDeck] = useState(false);
    const [toast, setToast] = useState(null);
    const longPressTimerRef = useRef(null);
    const frontTextareaRef = useRef(null);

    useEffect(() => {
        const fetchDecks = async () => {
            try {
                setLoading(true);
                setError('');
                const response = await axiosClient.get('/api/decks/');
                setDecks(response.data || []);
            } catch (err) {
                setError(err.response?.data?.detail || 'Could not load decks right now.');
            } finally {
                setLoading(false);
            }
        };

        fetchDecks();
    }, []);

    useEffect(() => {
        if (decks.length === 0) {
            if (selectedDeckId) {
                setSelectedDeckId('');
            }
            return;
        }

        const activeDeckExists = decks.some((deck) => String(deck.deck_id) === String(selectedDeckId));
        if (activeDeckExists) {
            return;
        }

        const storedDeckId = window.localStorage.getItem(LAST_USED_DECK_KEY);
        const storedDeckExists = storedDeckId
            ? decks.some((deck) => String(deck.deck_id) === String(storedDeckId))
            : false;

        setSelectedDeckId(storedDeckExists ? String(storedDeckId) : String(decks[0].deck_id));
    }, [decks, selectedDeckId]);

    useEffect(() => {
        if (!isAddCardModalOpen) {
            return;
        }

        const focusTimer = setTimeout(() => {
            frontTextareaRef.current?.focus();
        }, 0);

        return () => clearTimeout(focusTimer);
    }, [isAddCardModalOpen]);

    useEffect(() => {
        if (location.state?.toast) {
            setToast(location.state.toast);
            navigate('/dashboard', { replace: true, state: {} });
        }
    }, [location.state, navigate]);

    useEffect(() => {
        if (!toast) {
            return;
        }

        const timer = setTimeout(() => setToast(null), 3500);
        return () => clearTimeout(timer);
    }, [toast]);

    const handleAddCard = async (event, keepModalOpen = false) => {
        event.preventDefault();
        setCardFormError('');

        if (!selectedDeckId) {
            setCardFormError('Please choose a deck first.');
            return;
        }

        if (!frontText.trim() || !backText.trim()) {
            setCardFormError('Front and back text are required.');
            return;
        }

        try {
            setCreatingCard(true);
            await axiosClient.post(`/api/decks/${selectedDeckId}/cards`, {
                front_text: frontText,
                back_text: backText,
            });

            window.localStorage.setItem(LAST_USED_DECK_KEY, String(selectedDeckId));
            setFrontText('');
            setBackText('');

            if (keepModalOpen) {
                setToast({ type: 'success', message: 'Flashcard added. Add another one.' });
                setTimeout(() => {
                    frontTextareaRef.current?.focus();
                }, 0);
            } else {
                setToast({ type: 'success', message: 'Flashcard created.' });
                setIsAddCardModalOpen(false);
            }
        } catch (err) {
            setCardFormError(err.response?.data?.detail || 'Could not add flashcard right now.');
        } finally {
            setCreatingCard(false);
        }
    };

    const handleAddAnotherCard = (event) => {
        handleAddCard(event, true);
    };

    const openAddCardModal = () => {
        setCardFormError('');

        if (decks.length > 0) {
            const storedDeckId = window.localStorage.getItem(LAST_USED_DECK_KEY);
            const storedDeckExists = storedDeckId
                ? decks.some((deck) => String(deck.deck_id) === String(storedDeckId))
                : false;

            setSelectedDeckId(storedDeckExists ? String(storedDeckId) : String(decks[0].deck_id));
        }

        setIsAddCardModalOpen(true);
    };

    const closeAddCardModal = () => {
        setIsAddCardModalOpen(false);
    };

    const startDeckHold = (event, deck) => {
        if (event.target.closest('button')) {
            return;
        }

        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
        }

        longPressTimerRef.current = setTimeout(() => {
            setDeckToDelete(deck);
            setIsDeleteDeckModalOpen(true);
        }, 650);
    };

    const cancelDeckHold = () => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
    };

    const closeDeleteDeckModal = () => {
        setIsDeleteDeckModalOpen(false);
        setDeckToDelete(null);
    };

    const handleDeleteDeck = async () => {
        if (!deckToDelete) {
            return;
        }

        try {
            setDeletingDeck(true);
            await axiosClient.delete(`/api/decks/${deckToDelete.deck_id}`);
            setDecks((prev) => prev.filter((deck) => deck.deck_id !== deckToDelete.deck_id));

            if (String(selectedDeckId) === String(deckToDelete.deck_id)) {
                const nextDeck = decks.find((deck) => deck.deck_id !== deckToDelete.deck_id);
                const nextDeckId = nextDeck ? String(nextDeck.deck_id) : '';
                setSelectedDeckId(nextDeckId);
                if (nextDeckId) {
                    window.localStorage.setItem(LAST_USED_DECK_KEY, nextDeckId);
                } else {
                    window.localStorage.removeItem(LAST_USED_DECK_KEY);
                }
            }

            setToast({ type: 'success', message: 'Deck deleted.' });
            closeDeleteDeckModal();
        } catch (err) {
            setToast({ type: 'warning', message: err.response?.data?.detail || 'Could not delete deck.' });
        } finally {
            setDeletingDeck(false);
        }
    };

    const handleBrandClick = () => {
        navigate('/dashboard', {
            state: {
                toast: {
                    type: 'warning',
                    message: 'You are already on dashboard.',
                },
            },
        });
    };

    return (
        <div className="ma-page">
            <header className="ma-topbar">
                <div className="ma-topbar-left">
                    <button type="button" className="ma-brand-button" onClick={handleBrandClick}>
                        <h1 className="ma-brand">Mini Anki</h1>
                    </button>
                </div>
                <button type="button" className="ma-nav-link" onClick={logout}>
                    Logout
                </button>
            </header>

            {toast && (
                <div className="ma-toast-stack">
                    <div className={`ma-toast ma-toast-${toast.type}`}>{toast.message}</div>
                </div>
            )}

            <main className="ma-main">
                <section className="ma-title-row">
                    <div>
                        <h2 className="ma-headline-lg">Ready to study?</h2>
                        <p className="ma-subtle-text">Pick a deck and keep your streak going.</p>
                    </div>
                    <div className="ma-title-actions">
                        {!loading && decks.length > 0 && (
                            <button type="button" className="ma-btn ma-btn-secondary" onClick={openAddCardModal}>
                                Add Card
                            </button>
                        )}
                        <button type="button" className="ma-btn ma-btn-primary" onClick={() => navigate('/decks/new')}>
                            Create New Deck
                        </button>
                    </div>
                </section>

                {error && <div className="ma-alert ma-alert-error">{error}</div>}

                {loading ? (
                    <div className="ma-panel">Loading your decks...</div>
                ) : decks.length === 0 ? (
                    <div className="ma-empty-card">
                        <h3 className="ma-headline-md">No decks yet</h3>
                        <p className="ma-subtle-text">Create your first deck and add a card to start learning.</p>
                        <button type="button" className="ma-btn ma-btn-secondary" onClick={() => navigate('/decks/new')}>
                            Open Deck Editor
                        </button>
                    </div>
                ) : (
                    <section className="ma-grid">
                        {decks.map((deck, index) => (
                            <article
                                key={deck.deck_id}
                                className={`ma-deck-card ${index % 3 === 0 ? 'ma-deck-mint' : ''} ${index % 3 === 1 ? 'ma-deck-blue' : ''
                                    } ${index % 3 === 2 ? 'ma-deck-lavender' : ''}`}
                                onMouseDown={(event) => startDeckHold(event, deck)}
                                onMouseUp={cancelDeckHold}
                                onMouseLeave={cancelDeckHold}
                                onTouchStart={(event) => startDeckHold(event, deck)}
                                onTouchEnd={cancelDeckHold}
                                onTouchCancel={cancelDeckHold}
                            >
                                <div className="ma-tag">Deck</div>
                                <h3 className="ma-headline-md">{deck.title}</h3>
                                <p className="ma-subtle-text">Created {new Date(deck.created_at).toLocaleDateString()}</p>
                                <p className="ma-hold-hint">Tap and hold to delete</p>
                                <button
                                    type="button"
                                    className="ma-btn ma-btn-card"
                                    onClick={() => navigate(`/study/${deck.deck_id}`)}
                                >
                                    Study Now
                                </button>
                            </article>
                        ))}
                    </section>
                )}
            </main>

            {isAddCardModalOpen && (
                <div className="ma-modal-backdrop" onClick={closeAddCardModal}>
                    <div className="ma-modal-card" onClick={(event) => event.stopPropagation()}>
                        <div className="ma-modal-header">
                            <h3 className="ma-headline-md">Add Flashcard</h3>
                            <button type="button" className="ma-nav-link" onClick={closeAddCardModal}>
                                Close
                            </button>
                        </div>
                        <p className="ma-subtle-text">Choose a deck and add front/back text.</p>

                        {cardFormError && <div className="ma-alert ma-alert-error">{cardFormError}</div>}

                        <form className="ma-quick-add-form" onSubmit={handleAddCard}>
                            <label className="ma-field">
                                <span className="ma-label-chip ma-label-blue">DECK</span>
                                <select
                                    className="ma-input ma-select"
                                    value={selectedDeckId}
                                    onChange={(event) => {
                                        const nextDeckId = event.target.value;
                                        setSelectedDeckId(nextDeckId);
                                        window.localStorage.setItem(LAST_USED_DECK_KEY, nextDeckId);
                                    }}
                                    required
                                >
                                    {decks.map((deck) => (
                                        <option key={deck.deck_id} value={String(deck.deck_id)}>
                                            {deck.title}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className="ma-field">
                                <span className="ma-label-chip ma-label-mint">FRONT</span>
                                <textarea
                                    className="ma-textarea"
                                    rows={3}
                                    ref={frontTextareaRef}
                                    value={frontText}
                                    onChange={(event) => setFrontText(event.target.value)}
                                    placeholder="Front side text"
                                    required
                                />
                            </label>

                            <label className="ma-field">
                                <span className="ma-label-chip ma-label-lavender">BACK</span>
                                <textarea
                                    className="ma-textarea"
                                    rows={3}
                                    value={backText}
                                    onChange={(event) => setBackText(event.target.value)}
                                    placeholder="Back side text"
                                    required
                                />
                            </label>

                            <div className="ma-actions">
                                <button type="button" className="ma-btn ma-btn-secondary" onClick={closeAddCardModal}>
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="ma-btn ma-btn-secondary"
                                    onClick={handleAddAnotherCard}
                                    disabled={creatingCard}
                                >
                                    {creatingCard ? 'Adding...' : 'Add + Next'}
                                </button>
                                <button type="submit" className="ma-btn ma-btn-primary" disabled={creatingCard}>
                                    {creatingCard ? 'Adding...' : 'Add Flashcard'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isDeleteDeckModalOpen && deckToDelete && (
                <div className="ma-modal-backdrop" onClick={closeDeleteDeckModal}>
                    <div className="ma-modal-card" onClick={(event) => event.stopPropagation()}>
                        <div className="ma-modal-header">
                            <h3 className="ma-headline-md">Delete Deck</h3>
                            <button type="button" className="ma-nav-link" onClick={closeDeleteDeckModal}>
                                Close
                            </button>
                        </div>
                        <p className="ma-subtle-text">Delete "{deckToDelete.title}" and all its cards?</p>

                        <div className="ma-actions">
                            <button type="button" className="ma-btn ma-btn-secondary" onClick={closeDeleteDeckModal}>
                                Cancel
                            </button>
                            <button type="button" className="ma-btn ma-btn-danger" onClick={handleDeleteDeck} disabled={deletingDeck}>
                                {deletingDeck ? 'Deleting...' : 'Delete Deck'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
