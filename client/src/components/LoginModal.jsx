import React, { useState } from 'react';
import { api } from '../utils/api';

export default function LoginModal({ onLoginSuccess }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin');
  const [showPassword, setShowPassword] = useState(false);
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

  const handleUseDefault = () => {
    setUsername('admin');
    setPassword('admin');
    setError('');
  };

  return (
    <div className="login-page-screen">
      <div className="login-backdrop-glow"></div>
      
      <div className="login-card-container">
        {/* Brand Header */}
        <div className="login-card-header">
          <div className="login-brand-icon">
            <span>🏭</span>
          </div>
          <h2 className="login-title">Yamuna Plastics</h2>
          <p className="login-subtitle">Mobile Billing &amp; Tally Prime Integration Portal</p>
          <div className="login-badge-secure">
            <span className="secure-dot"></span>
            <span>Enterprise Authorized Access</span>
          </div>
        </div>

        {error && (
          <div className="login-alert-box error">
            <span>⚠️ {error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form-inner">
          <div className="login-field-group">
            <label className="login-label">
              <span>User ID / Username</span>
              <span className="req">*</span>
            </label>
            <div className="login-input-wrap">
              <span className="login-input-icon">👤</span>
              <input
                type="text"
                className="login-input-control"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter User ID (default: admin)"
                required
              />
            </div>
          </div>

          <div className="login-field-group">
            <label className="login-label">
              <span>Password</span>
              <span className="req">*</span>
            </label>
            <div className="login-input-wrap">
              <span className="login-input-icon">🔑</span>
              <input
                type={showPassword ? 'text' : 'password'}
                className="login-input-control"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password (default: admin)"
                required
              />
              <button
                type="button"
                className="login-pw-toggle"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                title={showPassword ? 'Hide Password' : 'Show Password'}
              >
                {showPassword ? '👁️' : '🙈'}
              </button>
            </div>
          </div>

          {/* Quick credential hint banner */}
          <div className="login-default-hint">
            <div className="hint-header">
              <span>💡 Default Login Credentials:</span>
              <button
                type="button"
                className="btn-quick-fill"
                onClick={handleUseDefault}
              >
                Auto-Fill
              </button>
            </div>
            <div className="hint-codes">
              <span>ID: <code>admin</code></span>
              <span>•</span>
              <span>Password: <code>admin</code></span>
            </div>
            <p className="hint-sub">You can update this password anytime in the new <strong>Profile &amp; Settings</strong> page.</p>
          </div>

          <button
            type="submit"
            className="btn-login-action"
            disabled={loading}
          >
            {loading ? (
              <span>⏳ Verifying Credentials...</span>
            ) : (
              <span>Sign In to Portal &rarr;</span>
            )}
          </button>
        </form>

        <div className="login-card-footer">
          <div className="footer-copyright">
            Yamuna Plastics Pvt. Ltd. · Factory &amp; Works GIDC Jamnagar
          </div>
          <div className="footer-secured-by">
            Zero-Click Tally Prime Sync &amp; Option 1 Auto e-Way Bill
          </div>
        </div>
      </div>
    </div>
  );
}
