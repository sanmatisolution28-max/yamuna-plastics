import React, { useState } from 'react';
import { api } from '../utils/api';
import { formatINR } from '../utils/numberToWords';

export default function PartyMaster({ parties, onPartyAdded }) {
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
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
      setShowAddModal(false);
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

  return (
    <div className="party-master-container">
      {/* Search & Add Customer Bar */}
      <div className="form-card" style={{ padding: '12px', marginBottom: '14px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="text"
            className="form-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Search customers by name, city, GSTIN..."
          />
          <button
            type="button"
            className="btn-primary-action"
            style={{ width: 'auto', padding: '10px 14px', whiteSpace: 'nowrap', fontSize: '13px' }}
            onClick={() => setShowAddModal(true)}
          >
            + Add Customer
          </button>
        </div>
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
    </div>
  );
}
