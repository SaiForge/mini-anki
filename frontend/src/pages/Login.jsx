// frontend/src/pages/Login.jsx
import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

export default function Login() {
    const navigate = useNavigate();
    const { login, register } = useContext(AuthContext);
    const minPasswordLength = 8;
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const normalizeErrorMessage = (err) => {
        const detail = err?.response?.data?.detail;

        if (Array.isArray(detail)) {
            const messages = detail
                .map((item) => (typeof item?.msg === 'string' ? item.msg : null))
                .filter(Boolean);
            if (messages.length > 0) {
                return messages.join(' ');
            }
        }

        if (typeof detail === 'string' && detail.trim()) {
            return detail;
        }

        if (typeof err?.message === 'string' && err.message.trim()) {
            return err.message;
        }

        return 'An error occurred. Try again!';
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (password.length < minPasswordLength) {
            setError(`Password must be at least ${minPasswordLength} characters.`);
            return;
        }

        try {
            if (isLogin) {
                await login(email, password);
            } else {
                await register(email, password);
            }
            // Navigate to dashboard after successful login/registration
            navigate('/dashboard');
        } catch (err) {
            setError(normalizeErrorMessage(err));
        }
    };

    return (
        <div className="ma-login-page">
            <div className="ma-login-decor" aria-hidden="true">
                <span className="ma-login-orb ma-login-orb-mint" />
                <span className="ma-login-orb ma-login-orb-lavender" />
            </div>

            <main className="ma-login-wrap">
                <header className="ma-login-header">
                    <h1 className="ma-login-brand">Mini Anki</h1>
                    <p className="ma-login-tagline">Bite-sized learning, big results</p>
                </header>

                <section className="ma-login-card">
                    <div className="ma-login-toggle" role="tablist" aria-label="Authentication mode">
                        <button
                            type="button"
                            className={`ma-login-toggle-btn ${isLogin ? 'is-active' : ''}`}
                            onClick={() => setIsLogin(true)}
                        >
                            Login
                        </button>
                        <button
                            type="button"
                            className={`ma-login-toggle-btn ${!isLogin ? 'is-active' : ''}`}
                            onClick={() => setIsLogin(false)}
                        >
                            Sign Up
                        </button>
                    </div>

                    {error && <div className="ma-alert ma-alert-error">{error}</div>}

                    <form onSubmit={handleSubmit} className="ma-login-form">
                        <label className="ma-login-field">
                            <span className="ma-login-label">Username or Email</span>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="ma-login-input"
                                placeholder="student@school.edu"
                            />
                        </label>

                        <label className="ma-login-field">
                            <span className="ma-login-label">Password</span>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="ma-login-input"
                                placeholder="••••••••"
                            />
                        </label>

                        {isLogin && <button type="button" className="ma-login-forgot">Forgot password?</button>}

                        <button type="submit" className="ma-login-submit">
                            {isLogin ? "Let's Study!" : 'Create Account'}
                            <span className="ma-login-submit-arrow">→</span>
                        </button>
                    </form>
                </section>

                <p className="ma-login-footer">
                    {isLogin ? 'New here? ' : 'Already have an account? '}
                    <button type="button" onClick={() => setIsLogin(!isLogin)} className="ma-login-footer-link">
                        {isLogin ? 'Create a free account' : 'Switch to login'}
                    </button>
                </p>
            </main>
        </div>
    );
}
