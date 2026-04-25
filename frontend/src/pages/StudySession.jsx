import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { axiosClient } from '../api/axiosClient';

export default function StudySession() {
    const navigate = useNavigate();
    const { deckId } = useParams();
    const [cards, setCards] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showCompletionToast, setShowCompletionToast] = useState(false);

    useEffect(() => {
        const fetchCards = async () => {
            try {
                setLoading(true);
                setError('');
                const res = await axiosClient.get(`/api/study/${deckId}/due`);
                setCards(res.data || []);
            } catch (err) {
                setError(err.response?.data?.detail || 'Could not load due cards.');
            } finally {
                setLoading(false);
            }
        };

        fetchCards();
    }, [deckId]);

    useEffect(() => {
        if (cards.length > 0 && currentIndex >= cards.length) {
            setShowCompletionToast(true);
            const timer = setTimeout(() => setShowCompletionToast(false), 3500);
            return () => clearTimeout(timer);
        }
    }, [cards.length, currentIndex]);

    const handleGrade = async (grade) => {
        const currentCard = cards[currentIndex];
        try {
            await axiosClient.post('/api/study/grade', {
                card_id: currentCard.card_id,
                grade,
            });

            setIsFlipped(false);
            if (grade === 'Again') {
                // Requeue "Again" cards to the end so they repeat in the same session.
                setCards((prevCards) => {
                    if (prevCards.length <= 1) {
                        return prevCards;
                    }

                    const reordered = [...prevCards];
                    const [cardToRepeat] = reordered.splice(currentIndex, 1);
                    reordered.push(cardToRepeat);
                    return reordered;
                });

                setTimeout(() => {
                    setCurrentIndex((prevIndex) => {
                        const isLastCard = prevIndex >= cards.length - 1;
                        return isLastCard ? 0 : prevIndex;
                    });
                }, 180);
                return;
            }

            setTimeout(() => setCurrentIndex((prev) => prev + 1), 180);
        } catch (err) {
            setError(err.response?.data?.detail || 'Could not submit card grade.');
        }
    };

    if (loading) {
        return <div className="ma-loading">Loading study session...</div>;
    }

    if (error) {
        return (
            <div className="ma-page ma-study-page">
                <div className="ma-alert ma-alert-error ma-centered-panel">{error}</div>
            </div>
        );
    }

    if (cards.length === 0) {
        return (
            <div className="ma-page ma-study-page">
                <div className="ma-centered-panel">
                    <h2 className="ma-headline-lg">All done for today!</h2>
                    <p className="ma-subtle-text">No cards are due right now.</p>
                    <button type="button" className="ma-btn ma-btn-primary" onClick={() => navigate('/dashboard')}>
                        Back to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    if (currentIndex >= cards.length) {
        return (
            <div className="ma-page ma-study-page">
                {showCompletionToast && (
                    <div className="ma-toast-stack">
                        <div className="ma-toast ma-toast-success">Session complete. Great job!</div>
                    </div>
                )}
                <div className="ma-centered-panel">
                    <h2 className="ma-headline-lg">Session complete!</h2>
                    <p className="ma-subtle-text">Great work. You reviewed all due cards.</p>
                    <button type="button" className="ma-btn ma-btn-primary" onClick={() => navigate('/dashboard')}>
                        Return to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    const progress = ((currentIndex + 1) / cards.length) * 100;
    const currentCard = cards[currentIndex];

    return (
        <div className="ma-page ma-study-page">
            <main className="ma-study-wrap">
                <div className="ma-study-top">
                    <div>
                        <h2 className="ma-headline-lg ma-fade-up ma-float-grade">Study Session</h2>
                        <p
                            key={`study-card-progress-${currentIndex}-${cards.length}`}
                            className="ma-subtle-text ma-fade-up ma-float-grade ma-fade-delay-1"
                        >
                            Card {currentIndex + 1} of {cards.length}
                        </p>
                    </div>
                    <button
                        type="button"
                        className="ma-btn ma-btn-secondary ma-float-grade ma-fade-up ma-fade-delay-2"
                        onClick={() => navigate('/dashboard')}
                    >
                        Exit
                    </button>
                </div>

                <div className="ma-progress-shell">
                    <div className="ma-progress-fill" style={{ width: `${progress}%` }} />
                </div>

                <div className="ma-flashcard-stage" onClick={() => setIsFlipped(!isFlipped)}>
                    <div className={`ma-flashcard ${isFlipped ? 'is-flipped' : ''}`}>
                        <div className="ma-flashcard-face ma-flashcard-front">
                            <div className="ma-card-badge">FRONT</div>
                            <p className="ma-card-text">{currentCard.front_text}</p>
                            <span className="ma-subtle-text">Tap card to reveal answer</span>
                        </div>
                        <div className="ma-flashcard-face ma-flashcard-back">
                            <div className="ma-card-badge">BACK</div>
                            <p className="ma-card-text">{currentCard.back_text}</p>
                            <span className="ma-subtle-text">Choose a grade below</span>
                        </div>
                    </div>
                </div>

                {isFlipped && (
                    <div className="ma-grade-row ma-fade-up">
                        <button
                            type="button"
                            onClick={() => handleGrade('Again')}
                            className="ma-grade-btn ma-grade-again ma-float-grade ma-fade-up"
                        >
                            Again
                        </button>
                        <button
                            type="button"
                            onClick={() => handleGrade('Hard')}
                            className="ma-grade-btn ma-grade-hard ma-float-grade ma-fade-up ma-fade-delay-1"
                        >
                            Hard
                        </button>
                        <button
                            type="button"
                            onClick={() => handleGrade('Good')}
                            className="ma-grade-btn ma-grade-good ma-float-grade ma-fade-up ma-fade-delay-2"
                        >
                            Good
                        </button>
                        <button
                            type="button"
                            onClick={() => handleGrade('Easy')}
                            className="ma-grade-btn ma-grade-easy ma-float-grade ma-fade-up ma-fade-delay-3"
                        >
                            Easy
                        </button>
                    </div>
                )}

                {error && (
                    <div className="ma-alert ma-alert-error ma-study-error">
                        {error}
                    </div>
                )}
            </main>
        </div>
    );
}
