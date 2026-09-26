import React, { useState } from 'react';
import { formatINR } from '../utils/numberToWords';
import { api } from '../utils/api';

export default function BillList({ invoices, onViewInvoice, onEditInvoice, onRefreshInvoices }) {
  const [filter, setFilter] = useState('all'); // all | pending | synced
  const [search, setSearch] = useState('');
  const [syncingId, setSyncingId] = useState(null);
  const [batchSyncing, setBatchSyncing] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [fetchingEwbId, setFetchingEwbId] = useState(null);

  // Filter list
  const filtered = invoices.filter((inv) => {
    const isSynced = Boolean(inv.tallySync?.synced);
    if (filter === 'pending' && isSynced) return false;
    if (filter === 'synced' && !isSynced) return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      const matchNo = inv.invoiceNo.toLowerCase().includes(q);
      const matchParty = inv.partyName.toLowerCase().includes(q);
      const matchGst = (inv.gstin || '').toLowerCase().includes(q);
      const matchEwb = (inv.ewayBill?.ewayBillNo || '').toLowerCase().includes(q);
      return matchNo || matchParty || matchGst || matchEwb;
    }
    return true;
  });

  const pendingCount = invoices.filter((i) => !i.tallySync?.synced).length;
  const syncedCount = invoices.filter((i) => i.tallySync?.synced).length;

  const handleFetchEwb = async (inv) => {
    setFetchingEwbId(inv.id);
    setFeedback(null);
    try {
      const res = await api.fetchEwayBill(inv.id);
      if (res.success && res.ewayBill) {
        setFeedback({
          type: 'success',
          text: `🚚 e-Way Bill #${res.ewayBill.ewayBillNo} retrieved & saved for Bill #${inv.invoiceNo}!`
        });
        if (onRefreshInvoices) onRefreshInvoices();
      } else {
        setFeedback({ type: 'error', text: `⚠️ ${res.error || res.message}` });
      }
    } catch (err) {
      setFeedback({ type: 'error', text: `Failed to fetch e-Way bill: ${err.message}` });
    } finally {
      setFetchingEwbId(null);
    }
  };

  const handleSyncSingle = async (inv) => {
    setSyncingId(inv.id);
    setFeedback(null);
    try {
      const res = await api.syncInvoiceToTally(inv.id);
      if (res.success) {
        setFeedback({ type: 'success', text: `✅ Bill #${inv.invoiceNo} pushed to Tally Prime Sales Register!` });
        // Automatically check if Tally generated an e-Way bill
        try {
          await api.fetchEwayBill(inv.id);
        } catch {}
      } else {
        setFeedback({ type: 'error', text: `⚠️ ${res.error || res.message}` });
      }
      if (onRefreshInvoices) onRefreshInvoices();
    } catch (err) {
      setFeedback({ type: 'error', text: `Tally Connection Failed: ${err.message}` });
    } finally {
      setSyncingId(null);
    }
  };

  const handleSyncAll = async () => {
    setBatchSyncing(true);
    setFeedback(null);
    try {
      const res = await api.syncAllToTally();
      if (res.success) {
        setFeedback({
          type: 'success',
          text: `🎉 Synced ${res.syncedCount || pendingCount} pending bills to Tally Prime!`
        });
      } else {
        setFeedback({ type: 'error', text: `⚠️ ${res.error || res.message}` });
      }
      if (onRefreshInvoices) onRefreshInvoices();
    } catch (err) {
      setFeedback({ type: 'error', text: `Could not connect to Tally on port 9000: ${err.message}` });
    } finally {
      setBatchSyncing(false);
    }
  };

  return (
    <div className="bill-list-container">
      {/* Banner / Feedback */}
      {feedback && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '12px',
            marginBottom: '14px',
            fontSize: '12.5px',
            fontWeight: 700,
            background: feedback.type === 'success' ? '#dcfce7' : '#fee2e2',
            color: feedback.type === 'success' ? '#15803d' : '#b91c1c',
            border: `1.5px solid ${feedback.type === 'success' ? '#86efac' : '#fca5a5'}`
          }}
        >
          {feedback.text}
        </div>
      )}

      {/* Top Controls: Search + Filter Chips */}
      <div className="form-card" style={{ padding: '12px', marginBottom: '14px' }}>
        <input
          type="text"
          className="form-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Search by Invoice No, Customer, GSTIN..."
          style={{ marginBottom: '10px' }}
        />

        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              className={`btn-sm-action ${filter === 'all' ? 'btn-sm-sync' : ''}`}
              onClick={() => setFilter('all')}
            >
              All ({invoices.length})
            </button>
            <button
              className={`btn-sm-action ${filter === 'pending' ? 'btn-sm-sync' : ''}`}
              onClick={() => setFilter('pending')}
            >
              ⏳ Pending ({pendingCount})
            </button>
            <button
              className={`btn-sm-action ${filter === 'synced' ? 'btn-sm-sync' : ''}`}
              onClick={() => setFilter('synced')}
            >
              ✅ Synced ({syncedCount})
            </button>
          </div>

          {pendingCount > 0 && (
            <button
              className="btn-sm-action btn-sm-sync"
              disabled={batchSyncing}
              onClick={handleSyncAll}
              style={{ fontWeight: 800 }}
            >
              {batchSyncing ? 'Syncing...' : `⚡ Sync ${pendingCount} to Tally`}
            </button>
          )}
        </div>
      </div>

      {/* Invoices List */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
          <div style={{ fontSize: '36px', marginBottom: '8px' }}>📄</div>
          <div style={{ fontWeight: 800, fontSize: '15px' }}>No bills found</div>
          <div style={{ fontSize: '12px' }}>Try changing the search query or generate a new bill</div>
        </div>
      ) : (
        filtered.map((inv) => {
          const isSynced = Boolean(inv.tallySync?.synced);
          const firstItem = inv.items?.[0]?.name || 'Plastic Products';
          const itemsExtraCount = (inv.items?.length || 1) - 1;

          return (
            <div key={inv.id} className="invoice-card">
              <div className="inv-card-head">
                <div>
                  <div className="inv-no">{inv.invoiceNo}</div>
                  <div className="inv-date">{inv.date} · Due: {inv.dueDate}</div>
                </div>
                <span className={`badge ${isSynced ? 'badge-synced' : 'badge-pending'}`}>
                  {isSynced ? '✓ Synced to Tally' : '⏳ Pending Tally'}
                </span>
              </div>

              <div className="inv-party">{inv.partyName}</div>

              <div className="inv-tags-row">
                <span className="badge" style={{ background: '#f1f5f9', color: '#475569' }}>
                  📦 {firstItem} {itemsExtraCount > 0 ? `+${itemsExtraCount} more` : ''}
                </span>
                {inv.isInterstate ? (
                  <span className="badge badge-interstate">IGST 18%</span>
                ) : (
                  <span className="badge" style={{ background: '#ecfdf5', color: '#047857' }}>CGST+SGST</span>
                )}
                {inv.vehicleNo && (
                  <span className="badge" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b' }}>
                    🚛 {inv.vehicleNo}
                  </span>
                )}
                {inv.ewayBill?.ewayBillNo && (
                  <span className="badge" style={{ background: '#f0fdf4', border: '1px solid #86efac', color: '#15803d', fontWeight: 800 }}>
                    🚚 EWB: {inv.ewayBill.ewayBillNo}
                  </span>
                )}
              </div>

              <div className="inv-card-foot">
                <div className="inv-total">{formatINR(inv.grandTotal)}</div>
                <div className="inv-actions">
                  <button
                    className="btn-sm-action"
                    onClick={() => onViewInvoice(inv)}
                    title="View Tax Invoice"
                  >
                    👁️ View
                  </button>
                  <button
                    className="btn-sm-action"
                    onClick={() => onEditInvoice && onEditInvoice(inv)}
                    title="Edit Bill Details"
                    style={{ color: '#2563eb', borderColor: '#bfdbfe' }}
                  >
                    ✏️ Edit
                  </button>
                  <button
                    className="btn-sm-action"
                    disabled={fetchingEwbId === inv.id}
                    onClick={() => handleFetchEwb(inv)}
                    title={inv.ewayBill?.ewayBillNo ? `e-Way Bill: ${inv.ewayBill.ewayBillNo}` : 'Fetch/Sync e-Way Bill from Tally'}
                    style={{ color: '#047857', borderColor: '#a7f3d0', background: '#ecfdf5', fontWeight: 700 }}
                  >
                    {fetchingEwbId === inv.id ? 'Fetching...' : (inv.ewayBill?.ewayBillNo ? '🚚 EWB' : '🚚 Get EWB')}
                  </button>
                  <a
                    href={`/api/tally/invoice-xml/${inv.id}`}
                    download={`Tally_${inv.invoiceNo.replace(/\//g, '_')}.xml`}
                    className="btn-sm-action"
                    title="Download XML"
                    style={{ textDecoration: 'none' }}
                  >
                    XML
                  </a>
                  {!isSynced && (
                    <button
                      className="btn-sm-action btn-sm-sync"
                      disabled={syncingId === inv.id}
                      onClick={() => handleSyncSingle(inv)}
                      title="Direct 1-Click Push to Tally Prime"
                    >
                      {syncingId === inv.id ? 'Pushing...' : '🔌 Push Tally'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
