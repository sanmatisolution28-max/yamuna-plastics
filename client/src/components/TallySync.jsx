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
      const isCloud = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
      let res;
      if (isCloud) {
        res = await api.triggerUniversalTallySync();
      } else {
        res = await api.syncAllToTally();
      }
      setSyncResult(res);
      if (onRefreshInvoices) onRefreshInvoices();
    } catch (err) {
      setSyncResult({
        success: false,
        message: err.message || 'Tally sync failed. Please check if Tally Prime is running on port 9000.'
      });
    } finally {
      setSyncingAll(false);
    }
  };

  const handleFetchMasters = async () => {
    setSyncingMasters(true);
    setMastersNotice(null);
    try {
      const res = await api.triggerUniversalTallySync();
      if (res.success) {
        setMastersNotice({
          type: 'success',
          text: `⚡ ${res.message || 'Customer Debtors loaded from Tally Prime!'} (${res.totalParties || parties.length} Customers)`
        });
        if (onRefreshInvoices) onRefreshInvoices();
      } else {
        setMastersNotice({
          type: 'warning',
          text: res.error || 'Could not fetch from Tally Prime on Port 9000.'
        });
      }
    } catch (err) {
      setMastersNotice({
        type: 'warning',
        text: err.message || '⚠️ Tally Prime connection timed out. Ensure Tally Prime is open on your PC.'
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
            <div>{syncResult.message || syncResult.error}</div>
            {Array.isArray(syncResult.errors) && syncResult.errors.length > 0 && (
              <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
                {syncResult.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* 2. Customer & Product Masters Sync Card */}
      <div className="form-card" style={{ border: '2px solid #10b981' }}>
        <div className="card-title-row">
          <div className="card-title">
            <span style={{ color: '#047857' }}>👥 Customers &amp; 📦 Products Data Sync (Tally Prime Master Data)</span>
          </div>
          <span style={{ background: '#ecfdf5', color: '#047857', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 800 }}>
            Tally Prime Source
          </span>
        </div>

        <div style={{ fontSize: '12.5px', color: '#475569', marginBottom: '14px', lineHeight: 1.5 }}>
          All customer parties (Sundry Debtors) and product catalog (Stock Items with HSN, GST rate, units &amp; rates) are synchronized directly with Tally Prime.
        </div>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
          <div style={{ flex: 1, background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
            <div style={{ fontSize: '26px', fontWeight: 900, color: '#047857' }}>{parties.length}</div>
            <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#64748b' }}>Sundry Debtors (Customers)</div>
          </div>
          <div style={{ flex: 1, background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
            <div style={{ fontSize: '26px', fontWeight: 900, color: '#2563eb' }}>⚡ Ready</div>
            <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#64748b' }}>Stock Items (Products)</div>
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
            {syncingMasters ? '⏳ Pulling Masters from Tally...' : '⚡ Sync Customers & Products from Tally'}
          </button>

          <label
            className="btn-sync-action"
            style={{ flex: 1, minWidth: '200px', textAlign: 'center', cursor: 'pointer', margin: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {importingXml ? 'Importing XML...' : '📥 Import Tally XML File'}
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

      {/* 3. 1-Click Client PC Bridge Connector */}
      <div className="form-card" style={{ background: '#f0fdf4', border: '1.5px solid #86efac' }}>
        <div className="card-title-row">
          <div className="card-title">
            <span style={{ color: '#166534' }}>🚀 1-Click Real-Time Tally Bridge (For Client PC)</span>
          </div>
        </div>

        <div style={{ fontSize: '12.5px', color: '#14532d', lineHeight: 1.6, marginBottom: '14px' }}>
          To enable <strong>instant automatic sync</strong> on any client PC with Tally Prime open (Port 9000), download and run the 1-Click Bridge. It connects the local Tally Prime with the cloud portal in real time without any setup!
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <a
            href="/api/tally/download-bridge-bat"
            download="Yamuna-Tally-Bridge.bat"
            className="btn-primary-action"
            style={{ textDecoration: 'none', background: '#16a34a', flex: 1, minWidth: '220px', textAlign: 'center', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            <span>⬇️ Download 1-Click Bridge (.bat)</span>
          </a>

          <a
            href="/api/tally/download-tdl"
            download="YamunaPlastics_Sync.tdl"
            className="btn-sync-action"
            style={{ textDecoration: 'none', flex: 1, minWidth: '200px', textAlign: 'center', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            <span>📄 Download Tally TDL File</span>
          </a>
        </div>
      </div>

      {/* 4. Simple Setup Guide */}
      <div className="form-card" style={{ background: '#f8fafc' }}>
        <div className="card-title-row">
          <div className="card-title">
            <span>📖 How to Connect Client Tally Prime (3 Easy Options)</span>
          </div>
        </div>

        <div style={{ fontSize: '12.5px', color: '#334155', lineHeight: 1.8 }}>
          <p style={{ margin: '0 0 8px' }}>
            <strong>Step 1: Enable Connectivity in Tally Prime:</strong><br />
            In Tally Prime, press <code>F1: Help</code> &gt; <code>Settings</code> &gt; <code>Connectivity</code> &gt; <code>Client/Server configuration</code>.<br />
            Set <em>TallyPrime acts as</em> to <strong>Both</strong> and <em>Port</em> to <strong>9000</strong>. (Restart Tally once).
          </p>

          <p style={{ margin: '0 0 8px' }}>
            <strong>Step 2: Choose your preferred sync method:</strong>
          </p>
          <ul style={{ margin: '0 0 8px', paddingLeft: '20px' }}>
            <li><strong>Method A (Automatic):</strong> Double-click the downloaded <code>Yamuna-Tally-Bridge.bat</code>. It runs quietly and keeps Customers, Products, and Invoices 100% in sync automatically.</li>
            <li><strong>Method B (In-Tally Button):</strong> Load <code>YamunaPlastics_Sync.tdl</code> under <code>F1 &gt; TDLs &amp; Add-ons &gt; F4</code>. A button <em>"Sync with Yamuna Cloud"</em> will appear on the Gateway of Tally.</li>
            <li><strong>Method C (1-Second File Import):</strong> In Tally Prime, press <code>Alt + E</code> &gt; <code>Masters</code> &gt; <code>Export (XML)</code> and click <em>"Import Tally XML File"</em> above.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
