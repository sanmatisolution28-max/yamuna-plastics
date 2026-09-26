import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';

export default function TallySync({
  invoices = [],
  parties = [],
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

  const handleFetchMasters = async () => {
    setSyncingMasters(true);
    setMastersNotice(null);
    try {
      const res = await api.fetchMastersFromTally();
      if (res.success) {
        setMastersNotice({
          type: 'success',
          text: `⚡ ${res.message} (${res.totalParties} Customers loaded)`
        });
        if (onRefreshInvoices) onRefreshInvoices();
      } else {
        const isCloud = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
        setMastersNotice({
          type: 'warning',
          text: isCloud
            ? `💡 Cloud Portal Note: Tally Prime is running on your local computer. To sync with this live cloud website, double-click "Sync_Tally_to_Cloud.bat" on your PC, or open http://localhost:5005.`
            : `⚠️ ${res.error || 'Could not fetch from Tally Prime on Port 9000.'}`
        });
      }
    } catch (err) {
      const isCloud = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
      setMastersNotice({
        type: 'warning',
        text: isCloud
          ? `💡 Cloud Portal Note: Tally Prime is on your local PC. Double-click "Sync_Tally_to_Cloud.bat" on your computer to push customers to the live portal, or open http://localhost:5005.`
          : `⚠️ Tally Prime Port 9000 is on standby. Ensure Tally is open.`
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
      {/* 1. Tally Connectivity & Bill Sync Card */}
      <div className="form-card">
        <div className="card-title-row">
          <div className="card-title">
            <span>🔌 Tally Prime Connection &amp; Bill Sync</span>
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
              {tallyStatus?.online ? 'Tally Prime is Connected (Port 9000)' : 'Tally Prime Port 9000 is on Standby'}
            </strong>
          </div>
          <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.5 }}>
            {tallyStatus?.message || 'Testing port 9000...'}
          </div>
          {tallyStatus?.configuredCompany && (
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>
              Company: <strong>{tallyStatus.activeCompany || tallyStatus.configuredCompany}</strong> | Port: <strong>{tallyStatus.port || 9000}</strong>
            </div>
          )}
        </div>

        {/* Counters */}
        <div style={{ display: 'flex', gap: '10px', margin: '14px 0' }}>
          <div style={{ flex: 1, background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 900, color: '#047857' }}>{syncedInvoices.length}</div>
            <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#64748b' }}>Synced in Tally</div>
          </div>
          <div style={{ flex: 1, background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 900, color: '#d97706' }}>{pendingInvoices.length}</div>
            <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#64748b' }}>Pending Sync</div>
          </div>
        </div>

        {/* Sync Bills Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            className="btn-primary-action"
            style={{ flex: 1, minWidth: '200px' }}
            disabled={syncingAll || pendingInvoices.length === 0}
            onClick={handleSyncAll}
          >
            {syncingAll
              ? 'Pushing Bills to Tally...'
              : `⚡ Push ${pendingInvoices.length} Pending Bills to Tally`}
          </button>

          <a
            href={api.getTallyExportXmlUrl(true)}
            download="YamunaPlastics_All_Invoices.xml"
            className="btn-sync-action"
            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
          >
            📥 Download Tally XML File
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

      {/* 2. Customer Masters Sync Card */}
      <div className="form-card" style={{ border: '2px solid #10b981' }}>
        <div className="card-title-row">
          <div className="card-title">
            <span style={{ color: '#047857' }}>👥 Customer Data Sync (Sundry Debtors from Tally)</span>
          </div>
          <span style={{ background: '#ecfdf5', color: '#047857', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 800 }}>
            Tally Prime Source
          </span>
        </div>

        <div style={{ fontSize: '12.5px', color: '#475569', marginBottom: '14px', lineHeight: 1.5 }}>
          All customer parties in the billing system are taken directly from Tally Prime. Only <strong>Sundry Debtors</strong> are pulled (with GSTIN, State, Billing Address, and Phone).
        </div>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
          <div style={{ flex: 1, background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
            <div style={{ fontSize: '26px', fontWeight: 900, color: '#047857' }}>{parties.length}</div>
            <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#64748b' }}>Total Customers (Sundry Debtors)</div>
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
            {syncingMasters ? '⏳ Pulling Customers from Tally...' : '⚡ Fetch Customers from Tally Prime (Port 9000)'}
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

      {/* 3. Simple Setup Guide */}
      <div className="form-card" style={{ background: '#f8fafc' }}>
        <div className="card-title-row">
          <div className="card-title">
            <span>📖 How to Connect Tally Prime (3 Easy Steps)</span>
          </div>
        </div>

        <ol style={{ paddingLeft: '20px', fontSize: '12.5px', color: '#334155', lineHeight: 1.8, margin: 0 }}>
          <li>
            <strong>Enable Port 9000 in Tally:</strong> Go to <code>F1: Help</code> &gt; <code>Settings</code> &gt; <code>Connectivity</code> &gt; <code>Client/Server configuration</code>. Set <em>TallyPrime acts as</em> to <strong>Server</strong> (or <strong>Both</strong>) and <em>Port</em> to <strong>9000</strong>. Restart Tally.
          </li>
          <li>
            <strong>Load TDL File:</strong> Go to <code>F1: Help</code> &gt; <code>TDLs &amp; Add-Ons</code> &gt; <code>F4: Manage Local TDLs</code>. Set <em>Load selected TDL files on startup</em> to <strong>Yes</strong>, and paste the TDL file path:
            <div
              style={{
                background: '#e2e8f0',
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
          <li>
            <strong>Sync from Inside Tally:</strong> In Gateway of Tally, press <strong>Y</strong> (Yamuna Plastics Mobile Sync) &gt; press <strong>S</strong> (Sync All Pending Bills from Live Portal). All bills will immediately import into your Sales Day Book!
          </li>
        </ol>
      </div>
    </div>
  );
}
