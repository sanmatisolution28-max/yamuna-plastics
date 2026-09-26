import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';

export default function TallySync({
  invoices = [],
  parties = [],
  items = [],
  settings,
  onRefreshInvoices
}) {
  const [tallyStatus, setTallyStatus] = useState(null);
  const [checking, setChecking] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [syncingMasters, setSyncingMasters] = useState(false);
  const [mastersNotice, setMastersNotice] = useState(null);
  const [importingXml, setImportingXml] = useState(false);

  // e-Way Bill Credentials & Auto-Generation State (Option 1)
  const [ewbForm, setEwbForm] = useState({
    enabled: true,
    mode: 'auto', // 'auto' (Option 1) or 'tally' (Option 2)
    gstin: '24AKNPP7596H1ZF',
    portalUsername: 'yamuna_ewb',
    portalPassword: '••••••••',
    gspProvider: 'NIC Direct Portal / Tally GSP',
    gspClientId: 'YAMUNA_GSP_CLIENT_ID_2026',
    gspClientSecret: '••••••••••••••••',
    autoSyncWithTally: true,
    defaultDispatchPincode: '382350',
    defaultDispatchAddress: '26, Patel Estate, Opp Muktidham Estate, Nikol Gam Road, Ahmedabad',
    alwaysGenerate: true
  });

  const [savingEwb, setSavingEwb] = useState(false);
  const [testingEwb, setTestingEwb] = useState(false);
  const [syncingAllEwb, setSyncingAllEwb] = useState(false);
  const [ewbFeedback, setEwbFeedback] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (settings?.ewayBill) {
      setEwbForm((prev) => ({
        ...prev,
        ...settings.ewayBill,
        gstin: settings.ewayBill.gstin || settings.company?.gstin || prev.gstin
      }));
    }
  }, [settings]);

  const checkStatus = async () => {
    setChecking(true);
    try {
      const res = await api.getTallyStatus();
      setTallyStatus(res);
    } catch (err) {
      setTallyStatus({
        online: false,
        message: 'Could not communicate with local Tally server.',
        error: err.message
      });
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const pendingInvoices = invoices.filter((i) => !i.tallySync?.synced);
  const syncedInvoices = invoices.filter((i) => i.tallySync?.synced);
  const ewbCount = invoices.filter((i) => Boolean(i.ewayBill?.ewayBillNo)).length;

  const handleSyncAll = async () => {
    setSyncingAll(true);
    setSyncResult(null);
    try {
      const res = await api.syncAllToTally();
      setSyncResult(res);
      if (onRefreshInvoices) onRefreshInvoices();
    } catch (err) {
      setSyncResult({ success: false, error: err.message });
    } finally {
      setSyncingAll(false);
    }
  };

  const handleSaveEwbCredentials = async () => {
    setSavingEwb(true);
    setEwbFeedback(null);
    try {
      await api.updateSettings({ ewayBill: ewbForm });
      setEwbFeedback({
        type: 'success',
        message: '✅ e-Way Bill credentials & auto-generation settings successfully saved!'
      });
    } catch (err) {
      setEwbFeedback({
        type: 'error',
        message: `❌ Failed to save credentials: ${err.message}`
      });
    } finally {
      setSavingEwb(false);
    }
  };

  const handleTestEwbHandshake = async () => {
    setTestingEwb(true);
    setEwbFeedback(null);
    try {
      const res = await api.testEwayBillConnection();
      setEwbFeedback({
        type: 'success',
        message: `✅ Handshake Successful! Connected to ${res.provider} for GSTIN ${res.gstin}. Live auto-generation is ACTIVE.`
      });
    } catch (err) {
      setEwbFeedback({
        type: 'error',
        message: `❌ Connection check failed: ${err.message}`
      });
    } finally {
      setTestingEwb(false);
    }
  };

  const handleSyncAllEwayBills = async () => {
    setSyncingAllEwb(true);
    setEwbFeedback(null);
    try {
      const res = await api.syncAllEwayBills();
      setEwbFeedback({
        type: 'success',
        message: `🎉 ${res.message}`
      });
      if (onRefreshInvoices) onRefreshInvoices();
    } catch (err) {
      setEwbFeedback({
        type: 'error',
        message: `❌ Sync error: ${err.message}`
      });
    } finally {
      setSyncingAllEwb(false);
    }
  };

  const handleFetchMasters = async () => {
    setSyncingMasters(true);
    setMastersNotice(null);
    try {
      const res = await api.fetchMastersFromTally();
      if (res.success) {
        setMastersNotice({
          type: 'success',
          text: `⚡ ${res.message} (${res.totalParties} Debtors & ${res.totalItems} Stock Items ready)`
        });
        if (onRefreshInvoices) onRefreshInvoices();
      } else {
        setMastersNotice({
          type: 'warning',
          text: `⚠️ ${res.error || 'Could not fetch from Tally Prime on Port 9000.'}`
        });
      }
    } catch (err) {
      setMastersNotice({
        type: 'warning',
        text: `⚠️ Tally Prime Port 9000 is on standby. Ensure Tally is open.`
      });
    } finally {
      setSyncingMasters(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const content = evt.target.result;
      setImportingXml(true);
      try {
        const res = await api.importTallyXml(content);
        if (res.success) {
          setMastersNotice({
            type: 'success',
            text: `✅ ${res.message}`
          });
          if (onRefreshInvoices) onRefreshInvoices();
        } else {
          setMastersNotice({
            type: 'error',
            text: `❌ ${res.error || 'Failed to parse XML'}`
          });
        }
      } catch (err) {
        setMastersNotice({
          type: 'error',
          text: `❌ Import error: ${err.message}`
        });
      } finally {
        setImportingXml(false);
      }
    };
    reader.readAsText(file);
  };

  const tdlFilePath = 'C:\\Users\\admin\\Downloads\\Projects\\Yamuna Plastics\\tdl\\YamunaPlastics_Sync.tdl';

  return (
    <div className="tally-sync-container">
      {/* 1. Tally Connectivity Status Card */}
      <div className="form-card">
        <div className="card-title-row">
          <div className="card-title">
            <span>🔌 Tally Prime Server Status</span>
          </div>
          <button className="btn-sm-action" onClick={checkStatus} disabled={checking}>
            {checking ? 'Testing...' : '🔄 Test Connection'}
          </button>
        </div>

        <div
          style={{
            padding: '14px',
            borderRadius: '12px',
            background: tallyStatus?.online ? '#ecfdf5' : '#fffbeb',
            border: `1.5px solid ${tallyStatus?.online ? '#a7f3d0' : '#fde68a'}`,
            marginBottom: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span
              className={`status-dot ${tallyStatus?.online ? '' : 'offline'}`}
              style={{ width: '10px', height: '10px' }}
            ></span>
            <strong style={{ color: tallyStatus?.online ? '#065f46' : '#92400e', fontSize: '14px' }}>
              {tallyStatus?.online ? 'Tally Prime is ONLINE & LISTENING' : 'Tally Prime Port 9000 is OFFLINE / STANDBY'}
            </strong>
          </div>
          <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.5 }}>
            {tallyStatus?.message || 'Testing port 9000...'}
          </div>
          {tallyStatus?.configuredCompany && (
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>
              Connected Company: <strong>{tallyStatus.activeCompany || tallyStatus.configuredCompany}</strong> | Port: <strong>{tallyStatus.port || 9000}</strong>
            </div>
          )}
        </div>

        {/* Metric Counters */}
        <div style={{ display: 'flex', gap: '10px', margin: '14px 0' }}>
          <div style={{ flex: 1, background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
            <div style={{ fontSize: '22px', fontWeight: 900, color: '#047857' }}>{syncedInvoices.length}</div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>Synced in Tally</div>
          </div>
          <div style={{ flex: 1, background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
            <div style={{ fontSize: '22px', fontWeight: 900, color: '#0284c7' }}>{ewbCount}</div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>e-Way Bills Active</div>
          </div>
          <div style={{ flex: 1, background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
            <div style={{ fontSize: '22px', fontWeight: 900, color: '#d97706' }}>{pendingInvoices.length}</div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>Pending Sync</div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            className="btn-primary-action"
            disabled={syncingAll || pendingInvoices.length === 0}
            onClick={handleSyncAll}
          >
            {syncingAll
              ? 'Pushing All Invoices to Tally...'
              : `⚡ Sync ${pendingInvoices.length} Pending Bills to Tally`}
          </button>

          <a
            href={api.getTallyExportXmlUrl(true)}
            download="YamunaPlastics_All_Invoices.xml"
            className="btn-sync-action"
            style={{ textDecoration: 'none' }}
          >
            📥 Download Full Tally XML File (All Bills)
          </a>
        </div>

        {syncResult && (
          <div
            style={{
              marginTop: '12px',
              padding: '12px',
              borderRadius: '10px',
              fontSize: '12.5px',
              background: syncResult.success ? '#dcfce7' : '#fee2e2',
              color: syncResult.success ? '#15803d' : '#b91c1c'
            }}
          >
            {syncResult.message || syncResult.error}
          </div>
        )}
      </div>

      {/* 2. Customer Masters Sync Card: Sundry Debtors */}
      <div className="form-card" style={{ border: '2px solid #10b981' }}>
        <div className="card-title-row">
          <div className="card-title">
            <span style={{ color: '#047857' }}>👥 Tally Customer Synchronization (Sundry Debtors)</span>
          </div>
          <span style={{ background: '#ecfdf5', color: '#047857', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 800 }}>
            Tally Prime Source
          </span>
        </div>

        <div style={{ fontSize: '12.5px', color: '#475569', marginBottom: '14px', lineHeight: 1.5 }}>
          All customer parties in the billing system are synchronized directly with Tally Prime. Only <strong>Sundry Debtors</strong> are extracted (with GSTIN, State, Billing Address, and Phone), keeping your billing dropdowns completely verified.
        </div>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
          <div style={{ flex: 1, background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
            <div style={{ fontSize: '26px', fontWeight: 900, color: '#047857' }}>{parties.length}</div>
            <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#64748b' }}>Sundry Debtors (Tally Prime Customers)</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-primary-action"
            style={{ flex: 1, minWidth: '220px', background: '#059669' }}
            disabled={syncingMasters}
            onClick={handleFetchMasters}
          >
            {syncingMasters ? '⏳ Pulling Customers from Tally...' : '⚡ Pull Customers from Tally Prime (Port 9000)'}
          </button>

          <label
            className="btn-sync-action"
            style={{ flex: 1, minWidth: '200px', textAlign: 'center', cursor: 'pointer', margin: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {importingXml ? 'Importing XML...' : '📥 Import Customer XML File'}
            <input
              type="file"
              accept=".xml"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
              disabled={importingXml}
            />
          </label>
        </div>

        {mastersNotice && (
          <div
            style={{
              marginTop: '12px',
              padding: '12px',
              borderRadius: '10px',
              fontSize: '12.5px',
              background: mastersNotice.type === 'success' ? '#dcfce7' : '#fee2e2',
              color: mastersNotice.type === 'success' ? '#15803d' : '#b91c1c',
              border: `1px solid ${mastersNotice.type === 'success' ? '#86efac' : '#fca5a5'}`
            }}
          >
            {mastersNotice.text}
          </div>
        )}
      </div>

      {/* 2. OPTION 1: e-Way Bill Credentials & Auto-Generation Setup Card */}
      <div className="form-card" style={{ border: '2px solid #3b82f6' }}>
        <div className="card-title-row">
          <div className="card-title">
            <span style={{ color: '#1d4ed8' }}>🚚 Option 1: Automatic e-Way Bill Credentials & Live Sync</span>
          </div>
          <span style={{ background: '#dbeafe', color: '#1e40af', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 800 }}>
            Active Mode
          </span>
        </div>

        <div style={{ fontSize: '12.5px', color: '#475569', marginBottom: '14px', lineHeight: 1.5 }}>
          Enter your Government e-Way Bill Portal / GSP credentials below. Bills generated from the mobile app will <strong>automatically generate the official Government e-Way Bill Number</strong>, store it in the database, and push the completed e-Way Bill into Tally Prime with <strong>0 manual steps in Tally</strong>!
        </div>

        {/* Integration Mode Switcher */}
        <div style={{ background: '#f1f5f9', padding: '10px 14px', borderRadius: '10px', marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', marginBottom: '8px' }}>
            e-Way Bill Operation Mode:
          </div>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
              <input
                type="radio"
                name="ewbMode"
                value="auto"
                checked={ewbForm.mode === 'auto'}
                onChange={(e) => setEwbForm({ ...ewbForm, mode: e.target.value })}
              />
              <strong>Option 1: 100% Fully Automatic (Portal API / GSP)</strong>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
              <input
                type="radio"
                name="ewbMode"
                value="tally"
                checked={ewbForm.mode === 'tally'}
                onChange={(e) => setEwbForm({ ...ewbForm, mode: e.target.value })}
              />
              <span>Option 2: Tally Synchronized (Auto-read from Tally)</span>
            </label>
          </div>
        </div>

        {/* Credentials Form Fields */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
              Taxpayer GSTIN
            </label>
            <input
              type="text"
              className="form-input"
              value={ewbForm.gstin}
              onChange={(e) => setEwbForm({ ...ewbForm, gstin: e.target.value.toUpperCase() })}
              placeholder="24AKNPP7596H1ZF"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
              e-Way Bill Portal Username
            </label>
            <input
              type="text"
              className="form-input"
              value={ewbForm.portalUsername}
              onChange={(e) => setEwbForm({ ...ewbForm, portalUsername: e.target.value })}
              placeholder="e.g. yamuna_ewb"
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#475569' }}>Portal Password</label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '11px', cursor: 'pointer', padding: 0 }}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              className="form-input"
              value={ewbForm.portalPassword}
              onChange={(e) => setEwbForm({ ...ewbForm, portalPassword: e.target.value })}
              placeholder="••••••••"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
              GSP / API Provider
            </label>
            <select
              className="form-input"
              value={ewbForm.gspProvider}
              onChange={(e) => setEwbForm({ ...ewbForm, gspProvider: e.target.value })}
            >
              <option value="NIC Direct Portal / Tally GSP">NIC Direct Portal / Tally GSP (Standard)</option>
              <option value="Tally Prime Direct GSP">Tally Prime Direct GSP</option>
              <option value="ClearTax GSP API">ClearTax GSP API</option>
              <option value="Masters India GSP">Masters India GSP</option>
              <option value="Sandbox / Simulation Gateway">Sandbox / Simulation Gateway (Testing)</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
              GSP Client ID
            </label>
            <input
              type="text"
              className="form-input"
              value={ewbForm.gspClientId}
              onChange={(e) => setEwbForm({ ...ewbForm, gspClientId: e.target.value })}
              placeholder="YAMUNA_GSP_CLIENT_ID_2026"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
              Dispatch From PIN Code
            </label>
            <input
              type="text"
              className="form-input"
              value={ewbForm.defaultDispatchPincode}
              onChange={(e) => setEwbForm({ ...ewbForm, defaultDispatchPincode: e.target.value })}
              placeholder="382350 (Nikol, Ahmedabad)"
            />
          </div>
        </div>

        {/* Checkbox Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#334155', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={ewbForm.alwaysGenerate}
              onChange={(e) => setEwbForm({ ...ewbForm, alwaysGenerate: e.target.checked })}
            />
            <span><strong>Always auto-generate e-Way Bill</strong> for every sales invoice with transport/vehicle details.</span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#334155', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={ewbForm.autoSyncWithTally}
              onChange={(e) => setEwbForm({ ...ewbForm, autoSyncWithTally: e.target.checked })}
            />
            <span><strong>Auto-scan Tally Prime</strong> and retrieve any e-Way Bill updates automatically.</span>
          </label>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            className="btn-primary-action"
            style={{ flex: 1, minWidth: '180px' }}
            disabled={savingEwb}
            onClick={handleSaveEwbCredentials}
          >
            {savingEwb ? 'Saving Credentials...' : '💾 Save Credentials & Settings'}
          </button>

          <button
            className="btn-sync-action"
            style={{ flex: 1, minWidth: '180px' }}
            disabled={testingEwb}
            onClick={handleTestEwbHandshake}
          >
            {testingEwb ? 'Testing Handshake...' : '🔌 Test Portal Connection'}
          </button>

          <button
            className="btn-sm-action"
            style={{ minWidth: '150px', background: '#0284c7', color: '#fff', border: 'none', padding: '10px 14px' }}
            disabled={syncingAllEwb}
            onClick={handleSyncAllEwayBills}
          >
            {syncingAllEwb ? 'Scanning Tally...' : '⚡ Scan & Sync All EWBs'}
          </button>
        </div>

        {/* Feedback Alert */}
        {ewbFeedback && (
          <div
            style={{
              marginTop: '14px',
              padding: '12px 16px',
              borderRadius: '10px',
              fontSize: '12.5px',
              lineHeight: 1.5,
              background: ewbFeedback.type === 'success' ? '#ecfdf5' : '#fee2e2',
              color: ewbFeedback.type === 'success' ? '#065f46' : '#991b1b',
              border: `1px solid ${ewbFeedback.type === 'success' ? '#a7f3d0' : '#fca5a5'}`
            }}
          >
            {ewbFeedback.message}
          </div>
        )}
      </div>

      {/* 3. Professional Client Integration SOP Card */}
      <div className="form-card" style={{ background: '#f8fafc', border: '1.5px solid #cbd5e1' }}>
        <div className="card-title-row">
          <div className="card-title">
            <span>🏢 Client Integration SOP — Professional Step-by-Step Procedure</span>
          </div>
          <span style={{ background: '#0f172a', color: '#ffffff', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 800 }}>
            Enterprise SOP
          </span>
        </div>

        <div style={{ fontSize: '12.5px', color: '#475569', marginBottom: '16px', lineHeight: 1.6 }}>
          Follow these 4 standard operating procedure (SOP) phases when onboarding or connecting a client PC with Yamuna Plastics Cloud Portal.
        </div>

        {/* Phase 1: Client PC Setup */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ background: '#3b82f6', color: '#fff', width: '22px', height: '22px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 900 }}>1</span>
            <strong style={{ fontSize: '13px', color: '#0f172a' }}>Phase 1: Client PC Setup (One-Time, 2 Minutes)</strong>
          </div>
          <ol style={{ paddingLeft: '24px', fontSize: '12px', color: '#334155', lineHeight: 1.6, margin: 0 }}>
            <li>
              <strong>Enable Port 9000 in Tally Prime:</strong> Go to <code>F1: Help</code> &gt; <code>Settings</code> &gt; <code>Connectivity</code> &gt; <code>Client/Server configuration</code>. Set <em>TallyPrime acts as</em> to <strong>Server</strong> (or <strong>Both</strong>) and <em>Port</em> to <strong>9000</strong>. Restart Tally.
            </li>
            <li>
              <strong>Load Single TDL File:</strong> Go to <code>F1: Help</code> &gt; <code>TDLs &amp; Add-Ons</code> &gt; <code>F4: Manage Local TDLs</code>. Set <em>Load selected TDL files on startup</em> to <strong>Yes</strong>.
            </li>
            <li>
              Paste the TDL path:
              <div
                style={{
                  background: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  margin: '6px 0',
                  userSelect: 'all',
                  wordBreak: 'break-all'
                }}
              >
                {tdlFilePath}
              </div>
            </li>
            <li>Press <strong>Ctrl + A</strong> to save. Gateway of Tally will now display: <strong>"Yamuna Plastics Mobile Sync" (HotKey: Y)</strong>.</li>
          </ol>
        </div>

        {/* Phase 2: Master Sync */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ background: '#10b981', color: '#fff', width: '22px', height: '22px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 900 }}>2</span>
            <strong style={{ fontSize: '13px', color: '#0f172a' }}>Phase 2: Master Sync (Admin 1-Click Pull)</strong>
          </div>
          <div style={{ fontSize: '12px', color: '#334155', lineHeight: 1.6 }}>
            <p style={{ margin: '0 0 6px 0' }}>
              On this portal (or in the <em>Create New Bill</em> screen), the Admin simply clicks:
            </p>
            <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '8px 12px', borderRadius: '8px', color: '#065f46', fontWeight: 700, display: 'inline-block', marginBottom: '6px' }}>
              ⚡ Pull Latest Masters from Tally Prime (Port 9000)
            </div>
            <p style={{ margin: '0', color: '#64748b' }}>
              The portal queries Tally via Port 9000 and pulls <strong>ONLY Sundry Debtors</strong> and <strong>Stock Items</strong> (with GSTIN, State code, Address, and HSN). Banks, Cash, and Expenses are filtered out automatically.
            </p>
          </div>
        </div>

        {/* Phase 3: Daily Bill Creation */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ background: '#6366f1', color: '#fff', width: '22px', height: '22px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 900 }}>3</span>
            <strong style={{ fontSize: '13px', color: '#0f172a' }}>Phase 3: Real-Time Sales Bill Generation &amp; 1-Click Push</strong>
          </div>
          <div style={{ fontSize: '12px', color: '#334155', lineHeight: 1.6 }}>
            <ul style={{ paddingLeft: '20px', margin: 0 }}>
              <li>Sales rep creates a tax invoice from any mobile or laptop on <strong>https://yamuna.sanmatisolution.com</strong>.</li>
              <li>Customer &amp; Product details auto-populate directly from Tally's verified masters.</li>
              <li>Click <strong>"⚡ Save &amp; Push to Tally (1-Click)"</strong>: The bill is immediately booked into Tally Prime Sales Register with proper CGST/SGST/IGST and vehicle details!</li>
            </ul>
          </div>
        </div>

        {/* Phase 4: Inside Tally Sync */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ background: '#0284c7', color: '#fff', width: '22px', height: '22px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 900 }}>4</span>
            <strong style={{ fontSize: '13px', color: '#0f172a' }}>Phase 4: Inside-Tally Reconciliation (Accountant 1-Key Pull)</strong>
          </div>
          <div style={{ fontSize: '12px', color: '#334155', lineHeight: 1.6 }}>
            If the client's accountant prefers working strictly inside Tally Prime:
            <ol style={{ paddingLeft: '20px', margin: '6px 0 0 0' }}>
              <li>In <strong>Gateway of Tally</strong>, press <strong>Y</strong> (Yamuna Plastics Mobile Sync).</li>
              <li>Press <strong>S</strong> (Sync All Pending Bills from Live Portal).</li>
              <li>Tally automatically fetches all pending bills over HTTPS and updates the Sales Day Book instantly!</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
