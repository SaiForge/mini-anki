import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { axiosClient } from '../api/axiosClient';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const minPasswordLength = 8;

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

    if (!token) {
      setError('Invalid or missing password reset link.');
      return;
    }

    if (newPassword.length < minPasswordLength) {
      setError(`Password must be at least ${minPasswordLength} characters.`);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await axiosClient.post('/api/auth/reset-password', {
        token: token,
        new_password: newPassword
      });
      setNotice(response?.data?.message || 'Password successfully reset. Redirecting...');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err) {
      setError(normalizeErrorMessage(err));
    } finally {
      setIsSubmitting(false);
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

        <section className="ma-login-card" style={{ minHeight: 'auto' }}>
          {!token ? (
            <div style={{ padding: '10px 0' }}>
              <h2 className="ma-login-brand" style={{ fontSize: '28px', color: '#93000a', marginBottom: '16px', textAlign: 'center', transform: 'none' }}>
                Invalid Link
              </h2>
              <div className="ma-alert ma-alert-error" style={{ marginBottom: '24px' }}>
                Invalid or missing password reset link.
              </div>
              <button
                type="button"
                className="ma-btn ma-btn-secondary"
                style={{ width: '100%', font: "700 24px/1 'Epilogue', sans-serif" }}
                onClick={() => navigate('/login')}
              >
                Back to Login
              </button>
            </div>
          ) : (
            <div style={{ padding: '10px 0' }}>
              <h2 className="ma-login-brand" style={{ fontSize: '28px', marginBottom: '16px', textAlign: 'center', transform: 'none' }}>
                Reset Password
              </h2>

              {notice && <div className="ma-alert ma-alert-success">{notice}</div>}
              {error && <div className="ma-alert ma-alert-error">{error}</div>}

              <form onSubmit={handleSubmit} className="ma-login-form">
                <label className="ma-login-field">
                  <span className="ma-login-label">New Password</span>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="ma-login-input"
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                </label>

                <label className="ma-login-field">
                  <span className="ma-login-label">Confirm New Password</span>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="ma-login-input"
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                </label>

                <button type="submit" className="ma-login-submit" style={{ marginTop: '14px' }} disabled={isSubmitting}>
                  {isSubmitting ? 'Updating...' : 'Update Password'}
                  <span className="ma-login-submit-arrow">→</span>
                </button>
              </form>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
