import React, { useState } from 'react';
import { api } from '../utils/api';

export default function LoginModal({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please enter both User ID and Password');
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
      setError(err.message || 'Invalid User ID or Password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-screen">
      {/* Dynamic Ambient Background Elements */}
      <div className="login-ambient-orb orb-1"></div>
      <div className="login-ambient-orb orb-2"></div>
      <div className="login-ambient-orb orb-3"></div>
      <div className="login-grid-pattern"></div>

      <div className="login-card-container">
        {/* Glowing Top Accent Bar */}
        <div className="login-card-top-accent"></div>

        {/* Brand Header */}
        <div className="login-card-header">
          <div className="login-brand-badge">
            <div className="brand-logo-hex">
              <svg viewBox="0 0 40 40" fill="none" className="brand-svg-icon" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 3L35 11.66V28.34L20 37L5 28.34V11.66L20 3Z" stroke="url(#logoGlow)" strokeWidth="2.5" fill="rgba(37, 99, 235, 0.25)" />
                <path d="M20 9L30 15V25L20 31L10 25V15L20 9Z" fill="url(#logoGrad)" />
                <path d="M16 17L20 22L24 17M20 22V27" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                <defs>
                  <linearGradient id="logoGlow" x1="5" y1="3" x2="35" y2="37" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#60a5fa" />
                    <stop offset="1" stopColor="#06b6d4" />
                  </linearGradient>
                  <linearGradient id="logoGrad" x1="10" y1="9" x2="30" y2="31" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#3b82f6" />
                    <stop offset="1" stopColor="#1d4ed8" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <div className="brand-pulse-ring"></div>
          </div>

          <h1 className="login-title">
            <span className="title-bold">YAMUNA</span> <span className="title-highlight">PLASTICS</span>
          </h1>
          <p className="login-subtitle">Cloud Billing &amp; Tally Prime Integration Portal</p>

          <div className="login-status-pill">
            <span className="live-status-dot"></span>
            <span className="status-text">Tally Prime Live Bridge Ready</span>
          </div>
        </div>

        {/* Error Alert Message */}
        {error && (
          <div className="login-alert-box error">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="login-form-inner" noValidate>
          <div className="login-field-group">
            <label className="login-label" htmlFor="login-username">
              <span>User ID / Username</span>
              <span className="req">*</span>
            </label>
            <div className="login-input-wrap">
              <span className="login-input-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              </span>
              <input
                id="login-username"
                type="text"
                className="login-input-control"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your User ID"
                required
                autoFocus
              />
            </div>
          </div>

          <div className="login-field-group">
            <div className="login-label-row">
              <label className="login-label" htmlFor="login-password">
                <span>Password</span>
                <span className="req">*</span>
              </label>
            </div>
            <div className="login-input-wrap">
              <span className="login-input-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </span>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                className="login-input-control"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your Password"
                required
              />
              <button
                type="button"
                className="login-pw-toggle"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide Password' : 'Show Password'}
                title={showPassword ? 'Hide Password' : 'Show Password'}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn-login-action"
            disabled={loading}
          >
            {loading ? (
              <span className="btn-content-loading">
                <span className="login-spinner"></span>
                <span>Authenticating...</span>
              </span>
            ) : (
              <span className="btn-content-ready">
                <span>Sign In to Portal</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </span>
            )}
          </button>
        </form>

        {/* Feature Pills */}
        <div className="login-features-row">
          <div className="feature-pill">
            <span className="feature-dot"></span>
            <span>256-bit Encrypted</span>
          </div>
          <div className="feature-pill">
            <span className="feature-dot"></span>
            <span>1-Click Tally Sync</span>
          </div>
          <div className="feature-pill">
            <span className="feature-dot"></span>
            <span>e-Way Bill Ready</span>
          </div>
        </div>

        {/* Card Footer */}
        <div className="login-card-footer">
          <div className="footer-copyright">
            Yamuna Plastics Pvt. Ltd. · Enterprise Edition
          </div>
          <div className="footer-secured-by">
            Seamless Bidirectional ERP &amp; GST Accounting Suite
          </div>
        </div>
      </div>
    </div>
  );
}

