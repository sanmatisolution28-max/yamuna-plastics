import React, { useState } from 'react';
import { api } from '../utils/api';
import { formatINR } from '../utils/numberToWords';

export default function ItemCatalog({ items, onItemAdded, onRefresh }) {
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [xmlContent, setXmlContent] = useState('');
  const [importing, setImporting] = useState(false);
  const [statusNotice, setStatusNotice] = useState(null);

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
      if (onRefresh) onRefresh();
      setShowAddModal(false);
      setStatusNotice({ type: 'success', text: `✅ Product "${created.name}" created and added to dropdowns!` });
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
    <div className="item-catalog-container">
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
            <span>📦 Products &amp; Stock Items Master</span>
            <span className="badge" style={{ background: '#0284c7', color: '#fff', fontSize: '11px' }}>
              {items.length} Items in Catalog
            </span>
          </div>
          <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>
            All products listed here automatically populate the <strong>"Select Product"</strong> dropdown when adding line items to a bill.
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-nav-secondary"
            style={{ fontSize: '12px', padding: '7px 12px' }}
            onClick={() => {
              setErrorMsg('');
              setShowImportModal(true);
            }}
            title="Import Stock Items from exported Tally XML file"
          >
            📥 Import Tally Items XML
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
            + Add Product
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

      {/* Search & Add Product Bar */}
      <div className="form-card" style={{ padding: '12px', marginBottom: '14px' }}>
        <input
          type="text"
          className="form-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Search products by name, HSN, category..."
        />
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

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '30px', color: '#64748b', fontSize: '13px' }}>
            No products found matching "{search}". Click <strong>+ Add Product</strong> or <strong>📥 Import Tally Items XML</strong> to add them.
          </div>
        )}
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
                      <option value="KGS">KGS (Kilograms)</option>
                      <option value="PCS">PCS (Pieces)</option>
                      <option value="BAGS">BAGS</option>
                      <option value="ROLLS">ROLLS</option>
                      <option value="BOX">BOX</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-col form-group">
                    <label className="form-label">Standard Base Rate (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-input"
                      value={newItem.baseRate}
                      onChange={(e) => setNewItem({ ...newItem, baseRate: Number(e.target.value) })}
                    />
                  </div>
                  <div className="form-col form-group">
                    <label className="form-label">GST Tax Rate (%)</label>
                    <select
                      className="form-select"
                      value={newItem.gstRate}
                      onChange={(e) => setNewItem({ ...newItem, gstRate: Number(e.target.value) })}
                    >
                      <option value={18}>18% (Standard GST)</option>
                      <option value={12}>12%</option>
                      <option value={5}>5%</option>
                      <option value={0}>0% (Exempt)</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-col form-group">
                    <label className="form-label">Initial Stock Quantity</label>
                    <input
                      type="number"
                      className="form-input"
                      value={newItem.stockQty}
                      onChange={(e) => setNewItem({ ...newItem, stockQty: Number(e.target.value) })}
                    />
                  </div>
                  <div className="form-col form-group">
                    <label className="form-label">Category</label>
                    <input
                      type="text"
                      className="form-input"
                      value={newItem.category}
                      onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                      placeholder="e.g. Bags, Films, Granules"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Description / Remarks</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newItem.description}
                    onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                    placeholder="e.g. Heavy Duty LDPE Liner Bags"
                  />
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

      {/* Import Tally Items XML Modal */}
      {showImportModal && (
        <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '540px' }}>
            <div className="modal-header">
              <div className="modal-title">📥 Import Stock Items from Tally Prime XML</div>
              <button className="btn-sm-action" onClick={() => setShowImportModal(false)}>✕</button>
            </div>
            <form onSubmit={handleImportXml}>
              <div className="modal-body">
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#475569', marginBottom: '14px', lineHeight: 1.5 }}>
                  <strong>How to export Stock Items from Tally Prime:</strong><br />
                  1. In Tally Prime, press <strong>Alt + E</strong> (Export) &gt; <strong>Masters</strong>.<br />
                  2. Select <strong>Stock Items</strong> (or <strong>All Masters</strong>).<br />
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
                    placeholder="<ENVELOPE>&#10;  <BODY>&#10;    <DATA>&#10;      <TALLYMESSAGE>&#10;        <STOCKITEM NAME=&quot;LDPE LINER BAGS&quot;>..."
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
