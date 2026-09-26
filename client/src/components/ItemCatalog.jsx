import React, { useState } from 'react';
import { api } from '../utils/api';
import { formatINR } from '../utils/numberToWords';

export default function ItemCatalog({ items, onItemAdded }) {
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItem, setNewItem] = useState({
    name: '',
    description: '',
    hsn: '39232100',
    unit: 'KGS',
    baseRate: 125.00,
    gstRate: 18,
    stockQty: 1000,
    category: 'Bags'
  });
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const filtered = items.filter((it) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      it.name.toLowerCase().includes(q) ||
      (it.hsn && it.hsn.toLowerCase().includes(q)) ||
      (it.category && it.category.toLowerCase().includes(q))
    );
  });

  const handleSaveItem = async (e) => {
    e.preventDefault();
    if (!newItem.name.trim()) {
      setErrorMsg('Product name is required.');
      return;
    }
    setSaving(true);
    setErrorMsg('');
    try {
      const created = await api.createItem(newItem);
      if (onItemAdded) onItemAdded(created);
      setShowAddModal(false);
      setNewItem({
        name: '',
        description: '',
        hsn: '39232100',
        unit: 'KGS',
        baseRate: 125.00,
        gstRate: 18,
        stockQty: 1000,
        category: 'Bags'
      });
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="item-catalog-container">
      {/* Search & Add Product Bar */}
      <div className="form-card" style={{ padding: '12px', marginBottom: '14px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="text"
            className="form-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Search products by name, HSN, category..."
          />
          <button
            type="button"
            className="btn-primary-action"
            style={{ width: 'auto', padding: '10px 14px', whiteSpace: 'nowrap', fontSize: '13px' }}
            onClick={() => setShowAddModal(true)}
          >
            + Add Product
          </button>
        </div>
      </div>

      {/* Items List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {filtered.map((it) => (
          <div key={it.id} className="invoice-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>{it.name}</div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>{it.description}</div>
              </div>
              <span className="badge" style={{ background: '#ecfdf5', color: '#047857', fontWeight: 800 }}>
                {it.gstRate}% GST
              </span>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', margin: '8px 0', flexWrap: 'wrap' }}>
              <span className="badge" style={{ background: '#f1f5f9', color: '#334155' }}>
                HSN: {it.hsn}
              </span>
              <span className="badge" style={{ background: '#e0f2fe', color: '#0369a1' }}>
                Stock: {it.stockQty?.toLocaleString()} {it.unit}
              </span>
              <span className="badge" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569' }}>
                {it.category || 'General'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '6px', borderTop: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: '12px', color: '#64748b' }}>Standard Rate:</span>
              <span style={{ fontSize: '15px', fontWeight: 900, color: '#0f172a' }}>
                {formatINR(it.baseRate)} / {it.unit}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <div className="modal-title">+ Add New Plastic Product</div>
              <button className="btn-sm-action" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveItem}>
              <div className="modal-body">
                {errorMsg && (
                  <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '8px 12px', borderRadius: '8px', marginBottom: '12px', fontSize: '12px' }}>
                    {errorMsg}
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Product Name <span className="required">*</span></label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={newItem.name}
                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                    placeholder="e.g. HDPE Transparent Bags"
                  />
                </div>
                <div className="form-row">
                  <div className="form-col form-group">
                    <label className="form-label">HSN Code</label>
                    <input
                      type="text"
                      className="form-input"
                      value={newItem.hsn}
                      onChange={(e) => setNewItem({ ...newItem, hsn: e.target.value })}
                      placeholder="39232100"
                    />
                  </div>
                  <div className="form-col form-group">
                    <label className="form-label">Unit of Measure</label>
                    <select
                      className="form-select"
                      value={newItem.unit}
                      onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                    >
                      <option value="KGS">KGS</option>
                      <option value="BAGS">BAGS</option>
                      <option value="ROLLS">ROLLS</option>
                      <option value="PCS">PCS</option>
                      <option value="MT">MT</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-col form-group">
                    <label className="form-label">Base Rate (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-input"
                      value={newItem.baseRate}
                      onChange={(e) => setNewItem({ ...newItem, baseRate: Number(e.target.value) })}
                    />
                  </div>
                  <div className="form-col form-group">
                    <label className="form-label">GST Rate %</label>
                    <select
                      className="form-select"
                      value={newItem.gstRate}
                      onChange={(e) => setNewItem({ ...newItem, gstRate: Number(e.target.value) })}
                    >
                      <option value="18">18% (Standard)</option>
                      <option value="12">12% (Woven Sacks)</option>
                      <option value="5">5%</option>
                      <option value="28">28%</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-sm-action" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary-action" style={{ width: 'auto', padding: '8px 16px' }} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
