import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('Verifying...');

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      fetch(`/api/auth/verify?token=${token}`)
        .then(res => res.json())
        .then(data => setStatus(data.message || 'Verification complete!'))
        .catch(err => setStatus('Verification failed.'));
    } else {
      setStatus('No token found.');
    }
  }, [searchParams]);

  return (
    <div className="ma-page ma-auth-page">
      <div className="ma-auth-card">
        <h2 className="ma-headline-md">Verify your email</h2>
        <p className="ma-subtle-text">{status}</p>
      </div>
    </div>
  );
}
