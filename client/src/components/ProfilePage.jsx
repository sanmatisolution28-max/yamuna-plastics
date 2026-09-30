import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';

export default function ProfilePage({ user, onLogout, settings, onSettingsUpdated }) {
  // Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwError, setPwError] = useState('');

  // Company Settings State
  const [companyForm, setCompanyForm] = useState({
    name: 'Yamuna Plastics',
    address: 'Shed No. C-1/28, GIDC Phase II, Dared',
    city: 'Jamnagar',
    state: 'Gujarat',
    pincode: '361004',
    gstin: '24AAFCY1234F1Z5',
    phone: '+91 98250 12345',
    email: 'yamunaplastics@gmail.com',
    bankName: 'State Bank of India',
    bankAccountNo: '30291823901',
    bankIfsc: 'SBIN0001234',
    bankBranch: 'GIDC Jamnagar'
  });
  const [companyLoading, setCompanyLoading] = useState(false);
  const [companySuccess, setCompanySuccess] = useState('');
  const [companyError, setCompanyError] = useState('');

  // Tally Config State
  const [tallyConfig, setTallyConfig] = useState({
    host: 'localhost',
    port: 9000,
    companyName: 'Sanmati Solution',
    salesVoucherType: 'Sales'
  });
  const [tallyTesting, setTallyTesting] = useState(false);
  const [tallyStatus, setTallyStatus] = useState(null);

  // Invoice & Voucher Sequence State
  const [seqForm, setSeqForm] = useState({
    invoicePrefix: 'YP/26-27/',
    nextInvoiceNumber: 1
  });
  const [seqLoading, setSeqLoading] = useState(false);
  const [seqSuccess, setSeqSuccess] = useState('');
  const [seqError, setSeqError] = useState('');

  useEffect(() => {
    if (settings?.company) {
      setCompanyForm((prev) => ({
        ...prev,
        ...settings.company,
        bankName: settings.company.bankName || prev.bankName,
        bankAccountNo: settings.company.bankAccountNo || prev.bankAccountNo,
        bankIfsc: settings.company.bankIfsc || prev.bankIfsc,
        bankBranch: settings.company.bankBranch || prev.bankBranch
      }));
    }
    if (settings?.tally) {
      setTallyConfig((prev) => ({
        ...prev,
        ...settings.tally
      }));
    }
    if (settings) {
      setSeqForm({
        invoicePrefix: settings.invoicePrefix || 'YP/26-27/',
        nextInvoiceNumber: settings.nextInvoiceNumber || 1
      });
    }
  }, [settings]);

  // Handle Password Update
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');

    if (!currentPassword) {
      setPwError('Please enter your current password.');
      return;
    }
    if (!newPassword || newPassword.length < 3) {
      setPwError('New password must be at least 3 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('New password and confirm password do not match.');
      return;
    }

    try {
      setPwLoading(true);
      const res = await api.changePassword({ currentPassword, newPassword });
      setPwSuccess(res.message || 'Password updated successfully! Next login requires this new password.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPwError(err.message || 'Failed to change password. Make sure current password is correct.');
    } finally {
      setPwLoading(false);
    }
  };

  // Handle Company Profile Save
  const handleCompanySave = async (e) => {
    e.preventDefault();
    setCompanyError('');
    setCompanySuccess('');

    try {
      setCompanyLoading(true);
      const res = await api.updateSettings({
        company: companyForm,
        tally: tallyConfig
      });
      setCompanySuccess('Company profile and bank details saved successfully!');
      if (onSettingsUpdated) onSettingsUpdated(res);
    } catch (err) {
      setCompanyError(err.message || 'Failed to save company settings.');
    } finally {
      setCompanyLoading(false);
    }
  };

  // Test Tally connection
  const handleTestTally = async () => {
    setTallyTesting(true);
    setTallyStatus(null);
    try {
      const res = await api.getTallyStatus();
      setTallyStatus(res);
    } catch (err) {
      setTallyStatus({ online: false, error: err.message });
    } finally {
      setTallyTesting(false);
    }
  };

  // Handle Invoice Sequence Save
  const handleSeqSave = async (e) => {
    e.preventDefault();
    setSeqError('');
    setSeqSuccess('');
    const nextNum = parseInt(seqForm.nextInvoiceNumber, 10);
    if (isNaN(nextNum) || nextNum < 1) {
      setSeqError('Next voucher number must be a valid positive number (e.g., 251).');
      return;
    }

    try {
      setSeqLoading(true);
      const prefix = seqForm.invoicePrefix.trim() || 'YP/26-27/';
      const updated = await api.updateSettings({
        invoicePrefix: prefix,
        nextInvoiceNumber: nextNum
      });
      setSeqSuccess(`✅ Sequence updated! The next generated bill will be "${prefix}${nextNum}".`);
      if (onSettingsUpdated) onSettingsUpdated(updated);
    } catch (err) {
      setSeqError(err.message || 'Failed to update voucher sequence.');
    } finally {
      setSeqLoading(false);
    }
  };

  return (
    <div className="profile-page-wrapper">
      {/* 1. Hero / Header Banner */}
      <div className="profile-hero-banner">
        <div className="profile-hero-inner">
          <div className="profile-user-spotlight">
            <div className="profile-avatar-large">
              <span>👤</span>
            </div>
            <div className="profile-user-meta">
              <div className="profile-name-row">
                <h2>{user?.name || 'Yamuna Administrator'}</h2>
                <span className="badge-super-admin">{user?.role || 'Super Admin'}</span>
              </div>
              <p className="profile-user-sub">
                Enterprise Cloud Billing &amp; Tally Prime Integration Operator
              </p>
              <div className="profile-badge-row">
                <span className="profile-pill-tag">
                  🆔 User ID: <strong>{user?.username || 'admin'}</strong>
                </span>
                <span className="profile-pill-tag">
                  🛡️ Security: <strong>Active Session</strong>
                </span>
                <span className="profile-pill-tag">
                  🏢 Tenant: <strong>Yamuna Plastics Pvt. Ltd.</strong>
                </span>
              </div>
            </div>
          </div>

          <div className="profile-header-actions">
            <button
              type="button"
              className="btn-danger-signout"
              onClick={onLogout}
              title="End active session and log out"
            >
              🚪 Sign Out (Logout)
            </button>
          </div>
        </div>
      </div>

      {/* 2. Main Content Grid (Security & Credentials / Business Master / Tally Sync) */}
      <div className="profile-grid-container">
        {/* Left Column: Security & Authentication */}
        <div className="profile-col-main">
          {/* Card A: Change Password */}
          <div className="profile-section-card">
            <div className="card-heading-group">
              <div className="card-icon-bubble green">🔑</div>
              <div>
                <h3>Change Account Password</h3>
                <p>Update credentials to prevent unauthorized billing or alterations.</p>
              </div>
            </div>

            {pwSuccess && (
              <div className="profile-alert success">
                <span>✅ {pwSuccess}</span>
              </div>
            )}

            {pwError && (
              <div className="profile-alert error">
                <span>⚠️ {pwError}</span>
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="profile-form">
              <div className="form-group">
                <label className="profile-form-label">
                  Current Password <span className="req">*</span>
                </label>
                <div className="input-password-wrapper">
                  <input
                    type={showCurrentPw ? 'text' : 'password'}
                    className="profile-input"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    required
                  />
                  <button
                    type="button"
                    className="btn-pw-toggle"
                    onClick={() => setShowCurrentPw(!showCurrentPw)}
                    tabIndex={-1}
                  >
                    {showCurrentPw ? '👁️' : '🙈'}
                  </button>
                </div>
              </div>

              <div className="form-row-split">
                <div className="form-group form-col">
                  <label className="profile-form-label">
                    New Password <span className="req">*</span>
                  </label>
                  <div className="input-password-wrapper">
                    <input
                      type={showNewPw ? 'text' : 'password'}
                      className="profile-input"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 4 characters"
                      required
                    />
                    <button
                      type="button"
                      className="btn-pw-toggle"
                      onClick={() => setShowNewPw(!showNewPw)}
                      tabIndex={-1}
                    >
                      {showNewPw ? '👁️' : '🙈'}
                    </button>
                  </div>
                </div>

                <div className="form-group form-col">
                  <label className="profile-form-label">
                    Confirm New Password <span className="req">*</span>
                  </label>
                  <input
                    type="password"
                    className="profile-input"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-type new password"
                    required
                  />
                </div>
              </div>

              <div className="profile-action-bar">
                <button
                  type="submit"
                  className="btn-primary-gradient"
                  disabled={pwLoading}
                >
                  {pwLoading ? 'Updating Password...' : '💾 Update Password Now'}
                </button>
              </div>
            </form>
          </div>

          {/* Card B: Security Checklist */}
          <div className="profile-section-card secondary">
            <div className="card-heading-group">
              <div className="card-icon-bubble blue">🛡️</div>
              <div>
                <h3>Access &amp; Security Highlights</h3>
                <p>Protection parameters configured for this deployment</p>
              </div>
            </div>

            <ul className="security-checklist">
              <li>
                <span className="check-icon">✓</span>
                <div>
                  <strong>Session Token Protection:</strong> User sessions are verified via cryptographically signed tokens.
                </div>
              </li>
              <li>
                <span className="check-icon">✓</span>
                <div>
                  <strong>Zero-Leak Local Storage:</strong> Password hashes are never broadcast in plain text across public logs.
                </div>
              </li>
              <li>
                <span className="check-icon">✓</span>
                <div>
                  <strong>Immediate Enforcement:</strong> Changing the password takes effect on the next sign-in immediately.
                </div>
              </li>
            </ul>
          </div>
        </div>

        {/* Right Column: Company & Tally Configuration */}
        <div className="profile-col-side">
          {/* Card C: Company Master Profile */}
          <div className="profile-section-card">
            <div className="card-heading-group">
              <div className="card-icon-bubble purple">🏭</div>
              <div>
                <h3>Company Profile &amp; Invoice Header</h3>
                <p>Details printed on all Tax Invoices and e-Way Bills</p>
              </div>
            </div>

            {companySuccess && (
              <div className="profile-alert success">
                <span>✅ {companySuccess}</span>
              </div>
            )}

            {companyError && (
              <div className="profile-alert error">
                <span>⚠️ {companyError}</span>
              </div>
            )}

            <form onSubmit={handleCompanySave} className="profile-form">
              <div className="form-group">
                <label className="profile-form-label">Company / Firm Name</label>
                <input
                  type="text"
                  className="profile-input"
                  value={companyForm.name}
                  onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="profile-form-label">Factory &amp; Works Address</label>
                <input
                  type="text"
                  className="profile-input"
                  value={companyForm.address}
                  onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                />
              </div>

              <div className="form-row-split">
                <div className="form-group form-col">
                  <label className="profile-form-label">City</label>
                  <input
                    type="text"
                    className="profile-input"
                    value={companyForm.city}
                    onChange={(e) => setCompanyForm({ ...companyForm, city: e.target.value })}
                  />
                </div>
                <div className="form-group form-col">
                  <label className="profile-form-label">GSTIN Number</label>
                  <input
                    type="text"
                    className="profile-input"
                    value={companyForm.gstin}
                    onChange={(e) => setCompanyForm({ ...companyForm, gstin: e.target.value.toUpperCase() })}
                  />
                </div>
              </div>

              <div className="form-row-split">
                <div className="form-group form-col">
                  <label className="profile-form-label">Bank Name</label>
                  <input
                    type="text"
                    className="profile-input"
                    value={companyForm.bankName}
                    onChange={(e) => setCompanyForm({ ...companyForm, bankName: e.target.value })}
                  />
                </div>
                <div className="form-group form-col">
                  <label className="profile-form-label">Bank A/C No.</label>
                  <input
                    type="text"
                    className="profile-input"
                    value={companyForm.bankAccountNo}
                    onChange={(e) => setCompanyForm({ ...companyForm, bankAccountNo: e.target.value })}
                  />
                </div>
              </div>

              <div className="profile-action-bar">
                <button
                  type="submit"
                  className="btn-secondary-save"
                  disabled={companyLoading}
                >
                  {companyLoading ? 'Saving...' : '💾 Save Company Details'}
                </button>
              </div>
            </form>
          </div>

          {/* Card: Invoice / Voucher Number Sequence */}
          <div className="profile-section-card">
            <div className="card-heading-group">
              <div className="card-icon-bubble green">🔢</div>
              <div>
                <h3>Voucher &amp; Invoice Number Sequence</h3>
                <p>Configure starting and sequential numbering for new bills</p>
              </div>
            </div>

            {seqSuccess && (
              <div className="profile-alert success">
                <span>{seqSuccess}</span>
              </div>
            )}

            {seqError && (
              <div className="profile-alert error">
                <span>⚠️ {seqError}</span>
              </div>
            )}

            <form onSubmit={handleSeqSave} className="profile-form">
              <div className="form-row-split">
                <div className="form-group form-col">
                  <label className="profile-form-label">Invoice Prefix</label>
                  <input
                    type="text"
                    className="profile-input"
                    value={seqForm.invoicePrefix}
                    onChange={(e) => setSeqForm({ ...seqForm, invoicePrefix: e.target.value })}
                    placeholder="YP/26-27/"
                    required
                  />
                  <small style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '4px', display: 'block' }}>
                    Prefix format (e.g. <code>YP/26-27/</code>)
                  </small>
                </div>

                <div className="form-group form-col">
                  <label className="profile-form-label">
                    Next Voucher Number <span className="req">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="profile-input"
                    style={{ fontWeight: 800, fontSize: '15px' }}
                    value={seqForm.nextInvoiceNumber}
                    onChange={(e) => setSeqForm({ ...seqForm, nextInvoiceNumber: e.target.value })}
                    placeholder="251"
                    required
                  />
                  <small style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '4px', display: 'block' }}>
                    Next bill to create (e.g. if 250 created, enter <strong>251</strong>)
                  </small>
                </div>
              </div>

              <div style={{ background: 'var(--bg-muted)', padding: '10px 14px', borderRadius: '10px', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '14px', border: '1px solid var(--border-light)', lineHeight: 1.5 }}>
                💡 <strong>Auto-Sequential Guarantee:</strong> When bill <code>{seqForm.invoicePrefix}{seqForm.nextInvoiceNumber || 1}</code> is generated, the sequence automatically advances to <strong>{(Number(seqForm.nextInvoiceNumber) || 1) + 1}</strong>.
              </div>

              <div className="profile-action-bar">
                <button
                  type="submit"
                  className="btn-secondary-save"
                  disabled={seqLoading}
                >
                  {seqLoading ? 'Saving Sequence...' : '💾 Save Voucher Sequence'}
                </button>
              </div>
            </form>
          </div>

          {/* Card D: Tally Prime Integration Status */}
          <div className="profile-section-card">
            <div className="card-heading-group">
              <div className="card-icon-bubble amber">🔌</div>
              <div>
                <h3>Tally Prime Integration Setup</h3>
                <p>Zero-Code client connection settings</p>
              </div>
            </div>

            <div className="tally-status-panel">
              <div className="tally-info-row">
                <span>Tally HTTP Port:</span>
                <strong>{tallyConfig.port || 9000} (localhost)</strong>
              </div>
              <div className="tally-info-row">
                <span>Configured Company:</span>
                <strong>{tallyConfig.companyName || 'Sanmati Solution'}</strong>
              </div>
              <div className="tally-info-row">
                <span>e-Way Bill Strategy:</span>
                <span className="badge-ewb-auto">Option 1: 100% Zero-Click Auto</span>
              </div>
              <div className="tally-info-row">
                <span>TDL Sync File:</span>
                <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#2563eb' }}>YamunaPlastics_Sync.tdl</span>
              </div>
            </div>

            {tallyStatus && (
              <div className={`profile-alert ${tallyStatus.online ? 'success' : 'warning'}`}>
                {tallyStatus.online ? (
                  <span>✅ Tally Prime is ONLINE! Connected to company: <b>{tallyStatus.activeCompany || tallyConfig.companyName}</b></span>
                ) : (
                  <span>⚠️ Tally Prime is on Standby on Port {tallyConfig.port}. (Bills queue in cloud and sync when Tally is opened).</span>
                )}
              </div>
            )}

            <div style={{ marginTop: '14px', display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn-test-tally"
                onClick={handleTestTally}
                disabled={tallyTesting}
              >
                {tallyTesting ? '⏳ Testing Connection...' : '⚡ Test Tally Connection'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
