import React, { useState } from 'react';
import { api } from '../utils/api';

export default function PartyMaster({ parties = [], onPartyAdded, onRefresh, onSelectForBill }) {
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedParty, setSelectedParty] = useState(null);
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
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.city && p.city.toLowerCase().includes(q)) ||
      (p.state && p.state.toLowerCase().includes(q)) ||
      (p.address && p.address.toLowerCase().includes(q)) ||
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
        setStatusNotice({ type: 'success', text: `⚡ ${res.message} (${res.totalParties} customers ready)` });
        if (onRefresh) onRefresh();
      } else {
        const isCloud = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
        setStatusNotice({
          type: 'warning',
          text: isCloud
            ? '💡 Cloud Tip: Run "Sync_Tally_to_Cloud.bat" on your PC to push customers from Tally Prime to this live portal.'
            : (res.error || 'Could not fetch from Tally. Make sure Tally is open on Port 9000.')
        });
      }
    } catch (err) {
      const isCloud = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
      setStatusNotice({
        type: 'warning',
        text: isCloud
          ? '💡 Cloud Tip: Run "Sync_Tally_to_Cloud.bat" on your PC to push customers from Tally Prime to this live portal.'
          : '⚠️ Tally Prime Port 9000 is on standby. All saved customers remain available.'
      });
    } finally {
      setFetchingTally(false);
    }
  };

  return (
    <div className="party-directory-wrapper">
      {/* 1. Header Bar */}
      <div className="directory-header-bar">
        <div className="header-left">
          <h2>Customers Directory (Sundry Debtors)</h2>
          <p className="header-sub">
            All customers synced from Tally Prime. These automatically populate the <strong>"Bill To"</strong> &amp; <strong>"Ship To"</strong> dropdowns when making bills.
          </p>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="btn-sync-tally-pill"
            onClick={handleFetchFromTally}
            disabled={fetchingTally}
          >
            {fetchingTally ? '⏳ Fetching Tally...' : '⚡ Sync from Tally'}
          </button>

          <button
            type="button"
            className="btn-add-customer-pill"
            onClick={() => {
              setErrorMsg('');
              setShowAddModal(true);
            }}
          >
            + New Customer
          </button>
        </div>
      </div>

      {/* Status Notice */}
      {statusNotice && (
        <div className={`workbench-alert ${statusNotice.type}`} style={{ marginBottom: '14px' }}>
          {statusNotice.text}
        </div>
      )}

      {/* 2. Search & Stats Bar */}
      <div className="directory-filter-bar">
        <div className="search-input-wrap">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="directory-search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by customer name, GSTIN, city, state, or address..."
          />
          {search && (
            <button type="button" className="clear-btn" onClick={() => setSearch('')}>
              ✕
            </button>
          )}
        </div>

        <div className="directory-count-badge">
          <span>{filtered.length} of {parties.length} Customers</span>
        </div>
      </div>

      {/* 3. Clean Customer Table */}
      <div className="directory-table-card">
        <div className="table-responsive-wrapper">
          <table className="directory-data-table">
            <thead>
              <tr>
                <th style={{ width: '38px', textAlign: 'center' }}>#</th>
                <th style={{ minWidth: '220px' }}>Customer / Firm Name</th>
                <th style={{ width: '150px' }}>GSTIN</th>
                <th style={{ width: '130px' }}>State / Code</th>
                <th style={{ minWidth: '220px' }}>Registered Address</th>
                <th style={{ width: '130px' }}>Phone / Mobile</th>
                <th style={{ width: '110px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, idx) => (
                <tr key={p.id || idx} className="customer-row">
                  <td style={{ textAlign: 'center', color: '#94a3b8', fontWeight: 700 }}>
                    {idx + 1}
                  </td>
                  <td>
                    <div className="cust-name-cell">
                      <strong className="cust-primary-name">{p.name}</strong>
                      <span className="cust-source-tag">Tally Prime</span>
                    </div>
                  </td>
                  <td>
                    <span className={`gstin-badge ${p.gstin ? 'active' : 'unregistered'}`}>
                      {p.gstin || 'Unregistered'}
                    </span>
                  </td>
                  <td>
                    <span className="state-badge">
                      {p.state || 'Gujarat'} ({p.stateCode || (p.gstin ? p.gstin.slice(0, 2) : '24')})
                    </span>
                  </td>
                  <td className="cust-address-cell">
                    {p.address || p.city || 'GIDC Industrial Area'}
                  </td>
                  <td>
                    <span className="cust-phone-cell">{p.phone || '-'}</span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      type="button"
                      className="btn-view-cust-details"
                      onClick={() => setSelectedParty(p)}
                      title="View all details for this customer"
                    >
                      👁️ Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="directory-empty-state">
              <span className="empty-icon">👥</span>
              <h4>No customers found matching "{search}"</h4>
              <p>Try clearing your search or click "⚡ Sync from Tally" to fetch customers from Tally Prime.</p>
            </div>
          )}
        </div>
      </div>

      {/* 4. Customer Details Drawer / Modal */}
      {selectedParty && (
        <div className="modal-overlay" onClick={() => setSelectedParty(null)}>
          <div className="modal-dialog cust-details-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-wrap">
                <span className="modal-title-icon">🏢</span>
                <div>
                  <div className="modal-title">{selectedParty.name}</div>
                  <div className="modal-subtitle">Customer / Sundry Debtor Profile</div>
                </div>
              </div>
              <button className="btn-close-modal-icon" onClick={() => setSelectedParty(null)}>
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ padding: '20px' }}>
              <div className="cust-profile-grid">
                <div className="profile-item">
                  <span className="item-label">Customer Legal Name:</span>
                  <strong className="item-val primary">{selectedParty.name}</strong>
                </div>

                <div className="profile-item">
                  <span className="item-label">GSTIN / UIN:</span>
                  <span className="item-val mono">{selectedParty.gstin || 'Unregistered'}</span>
                </div>

                <div className="profile-item">
                  <span className="item-label">State Name:</span>
                  <span className="item-val">{selectedParty.state || 'Gujarat'}</span>
                </div>

                <div className="profile-item">
                  <span className="item-label">GST State Code:</span>
                  <span className="item-val">{selectedParty.stateCode || (selectedParty.gstin ? selectedParty.gstin.slice(0, 2) : '24')}</span>
                </div>

                <div className="profile-item full-span">
                  <span className="item-label">Billing / Registered Address:</span>
                  <span className="item-val">{selectedParty.address || 'GIDC Industrial Area'}</span>
                </div>

                <div className="profile-item">
                  <span className="item-label">Contact Person:</span>
                  <span className="item-val">{selectedParty.contactPerson || '-'}</span>
                </div>

                <div className="profile-item">
                  <span className="item-label">Phone / Mobile:</span>
                  <span className="item-val">{selectedParty.phone || '-'}</span>
                </div>

                <div className="profile-item">
                  <span className="item-label">Payment Terms:</span>
                  <span className="item-val">{selectedParty.creditDays ? `Credit ${selectedParty.creditDays} Days` : 'Credit 30 Days'}</span>
                </div>

                <div className="profile-item">
                  <span className="item-label">Data Source:</span>
                  <span className="item-val">Tally Prime Port 9000 (Sundry Debtors)</span>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-sm-action"
                onClick={() => setSelectedParty(null)}
              >
                Close
              </button>

              {onSelectForBill && (
                <button
                  type="button"
                  className="btn-nav-primary"
                  style={{ padding: '7px 16px', fontSize: '12px' }}
                  onClick={() => {
                    onSelectForBill(selectedParty.id);
                    setSelectedParty(null);
                  }}
                >
                  📝 Create Bill for this Customer
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. Add Customer Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <div className="modal-title">+ Add New Customer</div>
              <button className="btn-close-modal-icon" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveParty}>
              <div className="modal-body" style={{ padding: '18px' }}>
                {errorMsg && (
                  <div className="workbench-alert error" style={{ marginBottom: '12px' }}>
                    {errorMsg}
                  </div>
                )}

                <div className="compact-form-row" style={{ marginBottom: '10px' }}>
                  <label>Customer / Business Name *</label>
                  <input
                    type="text"
                    className="clean-input"
                    value={newParty.name}
                    onChange={(e) => setNewParty({ ...newParty, name: e.target.value })}
                    placeholder="e.g. Maruti Granules Pvt. Ltd."
                    required
                  />
                </div>

                <div className="compact-form-grid-2" style={{ marginBottom: '10px' }}>
                  <div>
                    <label>GSTIN Number</label>
                    <input
                      type="text"
                      className="clean-input"
                      value={newParty.gstin}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase();
                        setNewParty({
                          ...newParty,
                          gstin: val,
                          stateCode: val.length >= 2 ? val.slice(0, 2) : newParty.stateCode
                        });
                      }}
                      placeholder="24AAFCY1234F1Z5"
                      maxLength={15}
                    />
                  </div>
                  <div>
                    <label>State Name</label>
                    <input
                      type="text"
                      className="clean-input"
                      value={newParty.state}
                      onChange={(e) => setNewParty({ ...newParty, state: e.target.value })}
                    />
                  </div>
                </div>

                <div className="compact-form-row" style={{ marginBottom: '10px' }}>
                  <label>Registered Office Address</label>
                  <textarea
                    className="clean-textarea"
                    rows={2}
                    value={newParty.address}
                    onChange={(e) => setNewParty({ ...newParty, address: e.target.value })}
                    placeholder="Plot / Shed No, GIDC Estate, City"
                  />
                </div>

                <div className="compact-form-grid-2">
                  <div>
                    <label>Phone / Mobile</label>
                    <input
                      type="text"
                      className="clean-input"
                      value={newParty.phone}
                      onChange={(e) => setNewParty({ ...newParty, phone: e.target.value })}
                      placeholder="+91 98250..."
                    />
                  </div>
                  <div>
                    <label>Credit Terms (Days)</label>
                    <input
                      type="number"
                      className="clean-input"
                      value={newParty.creditDays}
                      onChange={(e) => setNewParty({ ...newParty, creditDays: Number(e.target.value) })}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-sm-action"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-nav-primary"
                  disabled={saving}
                  style={{ padding: '7px 16px', fontSize: '12px' }}
                >
                  {saving ? 'Saving...' : '💾 Save Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
