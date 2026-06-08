// frontend/src/pages/Login.jsx
import { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { axiosClient } from '../api/axiosClient';
import ThemeToggle from '../components/ThemeToggle';

export default function Login() {
    const navigate = useNavigate();
    const { login, register } = useContext(AuthContext);
    const minPasswordLength = 8;
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    // Modals and states
    const [showVerificationModal, setShowVerificationModal] = useState(false);
    const [verificationEmail, setVerificationEmail] = useState('');
    const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
    const [forgotEmail, setForgotEmail] = useState('');
    const [resendCooldown, setResendCooldown] = useState(0);
    const [modalError, setModalError] = useState('');
    const [modalNotice, setModalNotice] = useState('');
    const [isSubmittingModal, setIsSubmittingModal] = useState(false);



    // Cooldown timer for resend button
    useEffect(() => {
        if (resendCooldown > 0) {
            const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [resendCooldown]);

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
        setNotice('');

        if (password.length < minPasswordLength) {
            setError(`Password must be at least ${minPasswordLength} characters.`);
            return;
        }

        try {
            if (isLogin) {
                await login(email, password);
                // Navigate to dashboard after successful login
                navigate('/dashboard');
                return;
            }

            const response = await register(email, password);
            setNotice(response?.message || 'Check your email to verify your account.');
            setIsLogin(true);
        } catch (err) {
            const errMsg = normalizeErrorMessage(err);
            setError(errMsg);
            
            // Show verification modal if email not verified
            if (errMsg === 'Email not verified. Check your inbox.') {
                setVerificationEmail(email);
                setShowVerificationModal(true);
            }
        }
    };

    const handleResendVerification = async () => {
        setModalError('');
        setModalNotice('');
        setIsSubmittingModal(true);

        try {
            const response = await axiosClient.post('/api/auth/resend-verification', {
                email: verificationEmail
            });
            setModalNotice(response.data.message);
            setResendCooldown(60);
        } catch (err) {
            setModalError(normalizeErrorMessage(err));
        } finally {
            setIsSubmittingModal(false);
        }
    };

    const handleForgotPasswordRequest = async () => {
        setModalError('');
        setModalNotice('');
        setIsSubmittingModal(true);

        try {
            const response = await axiosClient.post('/api/auth/forgot-password', {
                email: forgotEmail
            });
            setModalNotice(response.data.message);
            // Reset the form after successful request
            setTimeout(() => {
                setShowForgotPasswordModal(false);
                setForgotEmail('');
            }, 2000);
        } catch (err) {
            setModalError(normalizeErrorMessage(err));
        } finally {
            setIsSubmittingModal(false);
        }
    };

    const openForgotPasswordFromVerification = () => {
        setShowVerificationModal(false);
        setShowForgotPasswordModal(true);
        setForgotEmail(verificationEmail);
    };

    return (
        <div className="ma-login-page">
            <div className="ma-login-decor" aria-hidden="true">
                <span className="ma-login-orb ma-login-orb-mint" />
                <span className="ma-login-orb ma-login-orb-lavender" />
            </div>

            <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 10 }}>
                <ThemeToggle />
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
                            onClick={() => {
                                setIsLogin(true);
                                setError('');
                                setNotice('');
                            }}
                        >
                            Login
                        </button>
                        <button
                            type="button"
                            className={`ma-login-toggle-btn ${!isLogin ? 'is-active' : ''}`}
                            onClick={() => {
                                setIsLogin(false);
                                setError('');
                                setNotice('');
                            }}
                        >
                            Sign Up
                        </button>
                    </div>

                    {notice && <div className="ma-alert ma-alert-success">{notice}</div>}
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

                        {isLogin && (
                            <button 
                                type="button" 
                                className="ma-login-forgot"
                                onClick={() => {
                                    setShowForgotPasswordModal(true);
                                    setForgotEmail('');
                                    setModalError('');
                                    setModalNotice('');
                                }}
                            >
                                Forgot password?
                            </button>
                        )}

                        <button type="submit" className="ma-login-submit">
                            {isLogin ? "Let's Study!" : 'Create Account'}
                            <span className="ma-login-submit-arrow">→</span>
                        </button>
                    </form>
                </section>

                <p className="ma-login-footer">
                    {isLogin ? 'New here? ' : 'Already have an account? '}
                    <button
                        type="button"
                        onClick={() => {
                            setIsLogin(!isLogin);
                            setError('');
                            setNotice('');
                        }}
                        className="ma-login-footer-link"
                    >
                        {isLogin ? 'Create a free account' : 'Switch to login'}
                    </button>
                </p>
            </main>

            {/* Email Verification Modal */}
            {showVerificationModal && (
                <div className="ma-modal-overlay" onClick={() => setShowVerificationModal(false)}>
                    <div className="ma-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="ma-modal-header">
                            <h2>Verify Your Email</h2>
                            <button
                                type="button"
                                className="ma-modal-close"
                                onClick={() => setShowVerificationModal(false)}
                            >
                                ✕
                            </button>
                        </div>
                        <div className="ma-modal-body">
                            <p>We sent a verification link to <strong>{verificationEmail}</strong>. Check your inbox to verify your account.</p>
                            {modalError && <div className="ma-alert ma-alert-error">{modalError}</div>}
                            {modalNotice && <div className="ma-alert ma-alert-success">{modalNotice}</div>}
                        </div>
                        <div className="ma-modal-actions">
                            <button
                                type="button"
                                className="ma-btn ma-btn-primary"
                                onClick={handleResendVerification}
                                disabled={resendCooldown > 0 || isSubmittingModal}
                            >
                                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Verification Email'}
                            </button>
                            <button
                                type="button"
                                className="ma-btn ma-btn-secondary"
                                onClick={openForgotPasswordFromVerification}
                            >
                                Forgot Password?
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Forgot Password Modal */}
            {showForgotPasswordModal && (
                <div className="ma-modal-overlay" onClick={() => setShowForgotPasswordModal(false)}>
                    <div className="ma-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="ma-modal-header">
                            <h2>Reset Password</h2>
                            <button
                                type="button"
                                className="ma-modal-close"
                                onClick={() => setShowForgotPasswordModal(false)}
                            >
                                ✕
                            </button>
                        </div>
                        <div className="ma-modal-body">
                            <p>Enter your email address and we'll send you a link to reset your password.</p>
                            {modalError && <div className="ma-alert ma-alert-error">{modalError}</div>}
                            {modalNotice && <div className="ma-alert ma-alert-success">{modalNotice}</div>}
                            <input
                                type="email"
                                placeholder="Enter your email"
                                value={forgotEmail}
                                onChange={(e) => setForgotEmail(e.target.value)}
                                className="ma-login-input"
                            />
                        </div>
                        <div className="ma-modal-actions">
                            <button
                                type="button"
                                className="ma-btn ma-btn-primary"
                                onClick={handleForgotPasswordRequest}
                                disabled={!forgotEmail || isSubmittingModal}
                            >
                                {isSubmittingModal ? 'Sending...' : 'Send Reset Link'}
                            </button>
                            <button
                                type="button"
                                className="ma-btn ma-btn-secondary"
                                onClick={() => setShowForgotPasswordModal(false)}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
