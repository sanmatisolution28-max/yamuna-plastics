import React, { useState } from 'react';
import { api } from '../utils/api';
import { formatINR } from '../utils/numberToWords';

export default function PartyMaster({ parties, onPartyAdded, onRefresh }) {
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [xmlContent, setXmlContent] = useState('');
  const [importing, setImporting] = useState(false);
  const [fetchingTally, setFetchingTally] = useState(false);
  const [statusNotice, setStatusNotice] = useState(null);

  const [newParty, setNewParty] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: 'Gujarat',
    stateCode: '24',
    pincode: '',
    gstin: '',
    creditDays: 30
  });
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const filtered = parties.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.city && p.city.toLowerCase().includes(q)) ||
      (p.gstin && p.gstin.toLowerCase().includes(q))
    );
  });

  const handleSaveParty = async (e) => {
    e.preventDefault();
    if (!newParty.name.trim()) {
      setErrorMsg('Party / Business name is required.');
      return;
    }
    setSaving(true);
    setErrorMsg('');
    try {
      const created = await api.createParty(newParty);
      if (onPartyAdded) onPartyAdded(created);
      if (onRefresh) onRefresh();
      setShowAddModal(false);
      setStatusNotice({ type: 'success', text: `✅ Customer "${created.name}" created and added to dropdowns!` });
      setNewParty({
        name: '',
        contactPerson: '',
        phone: '',
        email: '',
        address: '',
        city: '',
        state: 'Gujarat',
        stateCode: '24',
        pincode: '',
        gstin: '',
        creditDays: 30
      });
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save customer');
    } finally {
      setSaving(false);
    }
  };

  // Direct fetch from local Tally Prime Port 9000
  const handleFetchFromTally = async () => {
    setFetchingTally(true);
    setStatusNotice(null);
    try {
      const res = await api.fetchMastersFromTally();
      if (res.success) {
        setStatusNotice({ type: 'success', text: `⚡ ${res.message}` });
        if (onRefresh) onRefresh();
      } else {
        setStatusNotice({ type: 'warning', text: `⚠️ ${res.error || 'Could not fetch from Tally. Make sure Tally is open on Port 9000.'}` });
      }
    } catch (err) {
      setStatusNotice({
        type: 'warning',
        text: `⚠️ Tally Prime not reachable on Port 9000. Tip: Use "📥 Import Tally XML" or export Masters XML from Tally.`
      });
    } finally {
      setFetchingTally(false);
    }
  };

  // Handle file upload for XML
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setXmlContent(event.target.result || '');
    };
    reader.readAsText(file);
  };

  // Import Tally XML
  const handleImportXml = async (e) => {
    e.preventDefault();
    if (!xmlContent.trim()) {
      setErrorMsg('Please paste Tally XML content or choose a .xml file.');
      return;
    }
    setImporting(true);
    setErrorMsg('');
    try {
      const res = await api.importTallyMastersXml(xmlContent);
      if (res.success) {
        setStatusNotice({ type: 'success', text: `✅ ${res.message}` });
        setShowImportModal(false);
        setXmlContent('');
        if (onRefresh) onRefresh();
      } else {
        setErrorMsg(res.error || 'Failed to import Tally XML.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Import failed.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="party-master-container">
      {/* Informative Header Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #f0fdf4 0%, #e0f2fe 100%)',
          border: '1px solid #bae6fd',
          borderRadius: '12px',
          padding: '14px 18px',
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div>
          <div style={{ fontWeight: 800, fontSize: '14px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>🏢 Customer &amp; Party Master</span>
            <span className="badge" style={{ background: '#3b82f6', color: '#fff', fontSize: '11px' }}>
              {parties.length} Parties in System
            </span>
          </div>
          <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>
            All customers listed here automatically appear in the <strong>"Select Existing Customer"</strong> dropdown when creating bills.
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-nav-secondary"
            style={{ fontSize: '12px', padding: '7px 12px' }}
            onClick={handleFetchFromTally}
            disabled={fetchingTally}
            title="Fetch all Sundry Debtors directly from open Tally Prime via Port 9000"
          >
            {fetchingTally ? '⏳ Fetching...' : '⚡ Fetch from Tally'}
          </button>

          <button
            type="button"
            className="btn-nav-secondary"
            style={{ fontSize: '12px', padding: '7px 12px' }}
            onClick={() => {
              setErrorMsg('');
              setShowImportModal(true);
            }}
            title="Import Ledgers from exported Tally XML file"
          >
            📥 Import Tally XML
          </button>

          <button
            type="button"
            className="btn-nav-primary"
            style={{ fontSize: '12px', padding: '7px 14px' }}
            onClick={() => {
              setErrorMsg('');
              setShowAddModal(true);
            }}
          >
            + Add Customer
          </button>
        </div>
      </div>

      {/* Status Notice */}
      {statusNotice && (
        <div
          style={{
            background: statusNotice.type === 'success' ? '#dcfce7' : '#fef3c7',
            border: `1.5px solid ${statusNotice.type === 'success' ? '#86efac' : '#fde68a'}`,
            color: statusNotice.type === 'success' ? '#15803d' : '#92400e',
            padding: '10px 14px',
            borderRadius: '10px',
            marginBottom: '14px',
            fontSize: '12.5px',
            fontWeight: 600
          }}
        >
          {statusNotice.text}
        </div>
      )}

      {/* Search Bar */}
      <div className="form-card" style={{ padding: '12px', marginBottom: '14px' }}>
        <input
          type="text"
          className="form-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Search customers by name, city, GSTIN..."
        />
      </div>

      {/* Parties List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {filtered.map((p) => (
          <div key={p.id} className="invoice-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>{p.name}</div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  {p.contactPerson} {p.phone ? `· ${p.phone}` : ''}
                </div>
              </div>
              <span className="badge" style={{ background: '#f1f5f9', color: '#334155' }}>
                {p.state} ({p.stateCode || '24'})
              </span>
            </div>

            <div style={{ fontSize: '11.5px', color: '#475569', margin: '6px 0' }}>
              📍 {p.address || p.city || 'Gujarat'}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '6px', borderTop: '1px solid #f1f5f9', fontSize: '11px' }}>
              <span><strong>GSTIN:</strong> {p.gstin || 'Unregistered'}</span>
              <span><strong>Terms:</strong> Net {p.creditDays || 30} Days</span>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '30px', color: '#64748b', fontSize: '13px' }}>
            No customers found matching "{search}". Click <strong>+ Add Customer</strong> or <strong>📥 Import Tally XML</strong> to add them.
          </div>
        )}
      </div>

      {/* Add Customer Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <div className="modal-title">+ Add New Customer</div>
              <button className="btn-sm-action" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveParty}>
              <div className="modal-body">
                {errorMsg && (
                  <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '8px 12px', borderRadius: '8px', marginBottom: '12px', fontSize: '12px' }}>
                    {errorMsg}
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Customer / Business Name <span className="required">*</span></label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={newParty.name}
                    onChange={(e) => setNewParty({ ...newParty, name: e.target.value })}
                    placeholder="e.g. Maruti Granules Pvt. Ltd."
                  />
                </div>
                <div className="form-row">
                  <div className="form-col form-group">
                    <label className="form-label">Contact Person</label>
                    <input
                      type="text"
                      className="form-input"
                      value={newParty.contactPerson}
                      onChange={(e) => setNewParty({ ...newParty, contactPerson: e.target.value })}
                      placeholder="Mr. Pravin"
                    />
                  </div>
                  <div className="form-col form-group">
                    <label className="form-label">Phone</label>
                    <input
                      type="text"
                      className="form-input"
                      value={newParty.phone}
                      onChange={(e) => setNewParty({ ...newParty, phone: e.target.value })}
                      placeholder="+91 9825..."
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-col form-group">
                    <label className="form-label">GSTIN</label>
                    <input
                      type="text"
                      className="form-input"
                      value={newParty.gstin}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase();
                        setNewParty({
                          ...newParty,
                          gstin: val,
                          stateCode: val.length >= 2 ? val.slice(0, 2) : newParty.stateCode
                        });
                      }}
                      placeholder="24AAFCY..."
                      maxLength={15}
                    />
                  </div>
                  <div className="form-col form-group">
                    <label className="form-label">State</label>
                    <input
                      type="text"
                      className="form-input"
                      value={newParty.state}
                      onChange={(e) => setNewParty({ ...newParty, state: e.target.value })}
                      placeholder="Gujarat"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Address</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newParty.address}
                    onChange={(e) => setNewParty({ ...newParty, address: e.target.value })}
                    placeholder="Plot / GIDC Estate, City"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-sm-action" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary-action" style={{ width: 'auto', padding: '8px 16px' }} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Tally XML Modal */}
      {showImportModal && (
        <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '540px' }}>
            <div className="modal-header">
              <div className="modal-title">📥 Import Masters from Tally Prime XML</div>
              <button className="btn-sm-action" onClick={() => setShowImportModal(false)}>✕</button>
            </div>
            <form onSubmit={handleImportXml}>
              <div className="modal-body">
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#475569', marginBottom: '14px', lineHeight: 1.5 }}>
                  <strong>How to export from Tally Prime:</strong><br />
                  1. In Tally Prime, press <strong>Alt + E</strong> (Export) &gt; <strong>Masters</strong>.<br />
                  2. Select <strong>Ledgers</strong> or <strong>All Masters</strong>.<br />
                  3. Set File Format to <strong>XML (Data Interchange)</strong> and Export.<br />
                  4. Choose the exported XML file below or copy-paste its content.
                </div>

                {errorMsg && (
                  <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '8px 12px', borderRadius: '8px', marginBottom: '12px', fontSize: '12px' }}>
                    {errorMsg}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Upload XML File</label>
                  <input
                    type="file"
                    accept=".xml"
                    onChange={handleFileUpload}
                    className="form-input"
                    style={{ padding: '6px' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Or Paste Tally XML Content Directly</label>
                  <textarea
                    rows={6}
                    className="form-input"
                    style={{ fontFamily: 'monospace', fontSize: '11px' }}
                    value={xmlContent}
                    onChange={(e) => setXmlContent(e.target.value)}
                    placeholder="<ENVELOPE>&#10;  <BODY>&#10;    <DATA>&#10;      <TALLYMESSAGE>&#10;        <LEDGER NAME=&quot;MARUTI GRANULES&quot;>..."
                  ></textarea>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-sm-action" onClick={() => setShowImportModal(false)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary-action"
                  style={{ width: 'auto', padding: '8px 18px' }}
                  disabled={importing || !xmlContent.trim()}
                >
                  {importing ? '⏳ Importing...' : '📥 Import to Portal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
