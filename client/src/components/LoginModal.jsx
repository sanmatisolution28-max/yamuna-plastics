import React, { useState } from 'react';
import { api } from '../utils/api';

export default function LoginModal({ onLoginSuccess }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please enter both ID and Password');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await api.login({ username: username.trim(), password });
      if (res.token) {
        localStorage.setItem('yp_auth_token', res.token);
        localStorage.setItem('yp_user', JSON.stringify(res.user));
        onLoginSuccess(res.user);
      }
    } catch (err) {
      setError(err.message || 'Invalid ID or Password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-overlay">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo-circle">🏭</div>
          <h2>Yamuna Plastics</h2>
          <p className="login-subtitle">Mobile Billing &amp; Tally Prime Integration Portal</p>
          <div className="login-security-tag">🔒 Authorized Access Only</div>
        </div>

        {error && (
          <div className="login-error-alert">
            <span>⚠️ {error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="login-username">User ID / Username</label>
            <div className="input-with-icon">
              <span className="input-icon">👤</span>
              <input
                id="login-username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter User ID (e.g. admin)"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="login-password">Password</label>
            <div className="input-with-icon">
              <span className="input-icon">🔑</span>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter Password"
                required
              />
            </div>
          </div>

          <div className="login-hint-box">
            <span>💡 <b>Default Access:</b> ID: <code>admin</code> | Password: <code>admin</code></span>
            <small>You can change this password anytime in your Profile after logging in.</small>
          </div>

          <button type="submit" className="btn-login-submit" disabled={loading}>
            {loading ? 'Authenticating...' : 'Sign In to Portal →'}
          </button>
        </form>

        <div className="login-footer">
          <span>Yamuna Plastics Pvt. Ltd. · Enterprise Cloud Portal</span>
        </div>
      </div>
    </div>
  );
}
