import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { axiosClient } from '../api/axiosClient';

export default function DeckEditor() {
    const navigate = useNavigate();

    const [title, setTitle] = useState('');
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState('');
    const titleInputRef = useRef(null);

    useEffect(() => {
        const focusTimer = setTimeout(() => {
            titleInputRef.current?.focus();
        }, 0);

        return () => clearTimeout(focusTimer);
    }, []);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setCreating(true);
        setError('');

        try {
            await axiosClient.post('/api/decks/', { title });

            navigate('/dashboard');
        } catch (err) {
            setError(err.response?.data?.detail || 'Could not save deck right now.');
        } finally {
            setCreating(false);
        }
    };

    const handleBrandClick = () => {
        navigate('/dashboard', {
            state: {
                toast: {
                    type: 'warning',
                    message: 'Returned to dashboard. Unsaved deck changes were discarded.',
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
            </header>

            <main className="ma-main ma-editor-wrap">
                <section className="ma-editor-header">
                    <h2 className="ma-headline-lg">Draft a New Deck</h2>
                    <p className="ma-subtle-text">Create a deck with title only. Add cards later from your workflow.</p>
                </section>

                {error && <div className="ma-alert ma-alert-error">{error}</div>}

                <form className="ma-editor-form" onSubmit={handleSubmit}>
                    <label className="ma-field">
                        <span className="ma-label-chip ma-label-blue">DECK TITLE</span>
                        <input
                            type="text"
                            maxLength={100}
                            required
                            ref={titleInputRef}
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                            className="ma-input"
                            placeholder="Japanese Vocab N5"
                        />
                    </label>

                    <div className="ma-actions">
                        <button type="button" className="ma-btn ma-btn-secondary" onClick={() => navigate('/dashboard')}>
                            Cancel
                        </button>
                        <button type="submit" className="ma-btn ma-btn-primary" disabled={creating}>
                            {creating ? 'Saving...' : 'Save Deck'}
                        </button>
                    </div>
                </form>
            </main>
        </div>
    );
}
