import React, { useState } from 'react';
import { api } from '../utils/api';

export default function ProfileModal({ user, onClose, onLogout }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!currentPassword) {
      setErrorMsg('Please enter your current password');
      return;
    }
    if (!newPassword || newPassword.length < 3) {
      setErrorMsg('New password must be at least 3 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('New password and confirm password do not match');
      return;
    }

    try {
      setLoading(true);
      const res = await api.changePassword({ currentPassword, newPassword });
      setSuccessMsg(res.message || 'Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content profile-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="header-title-wrap">
            <span className="modal-icon">👤</span>
            <div>
              <h3>User Profile &amp; Security Settings</h3>
              <p className="modal-subtitle">Manage credentials for Yamuna Plastics Cloud Portal</p>
            </div>
          </div>
          <button type="button" className="btn-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* User Account Overview */}
          <div className="profile-overview-card">
            <div className="profile-avatar">👨‍💼</div>
            <div className="profile-details">
              <h4>{user?.name || 'Administrator'}</h4>
              <p className="profile-username">User ID: <b>{user?.username || 'admin'}</b></p>
              <span className="badge-role">{user?.role || 'Super Admin'}</span>
            </div>
          </div>

          {/* Change Password Form */}
          <div className="password-section">
            <h4 className="section-title">🔑 Change Password</h4>
            <p className="section-desc">Update your password to protect this portal from unauthorized billing.</p>

            {successMsg && (
              <div className="alert-box success">
                <span>✅ {successMsg}</span>
              </div>
            )}

            {errorMsg && (
              <div className="alert-box error">
                <span>⚠️ {errorMsg}</span>
              </div>
            )}

            <form onSubmit={handlePasswordChange} className="password-form">
              <div className="form-group">
                <label>Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password (default: admin)"
                  required
                />
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    required
                  />
                </div>
              </div>

              <div className="form-actions">
                <button type="submit" className="btn-update-password" disabled={loading}>
                  {loading ? 'Saving...' : '💾 Save New Password'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Modal Footer with Logout */}
        <div className="modal-footer profile-modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
          <button type="button" className="btn-danger-logout" onClick={onLogout}>
            🚪 Sign Out (Logout)
          </button>
        </div>
      </div>
    </div>
  );
}
