import React, { useState } from 'react';
import { formatINR } from '../utils/numberToWords';
import { api } from '../utils/api';

export default function BillList({ invoices = [], settings, onViewInvoice, onEditInvoice, onRefreshInvoices }) {
  const [filter, setFilter] = useState('all'); // all | pending | synced
  const [search, setSearch] = useState('');
  const [syncingId, setSyncingId] = useState(null);
  const [batchSyncing, setBatchSyncing] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Calculate highest existing voucher and next sequence
  let maxNum = 0;
  let latestInvoiceNo = null;
  for (const inv of invoices) {
    const match = String(inv.invoiceNo || '').match(/(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) {
        maxNum = num;
        latestInvoiceNo = inv.invoiceNo;
      }
    }
  }

  const prefix = settings?.invoicePrefix || 'YP/26-27/';
  const configuredNext = Number(settings?.nextInvoiceNumber);
  if (!latestInvoiceNo && configuredNext && configuredNext > 1) {
    maxNum = configuredNext - 1;
    latestInvoiceNo = `${prefix}${maxNum}`;
  }
  const nextSeq = Math.max(configuredNext || 1, maxNum + 1);
  const nextInvoiceNo = `${prefix}${nextSeq}`;

  // Filter list
  const filtered = invoices.filter((inv) => {
    const isSynced = Boolean(inv.tallySync?.synced);
    if (filter === 'pending' && isSynced) return false;
    if (filter === 'synced' && !isSynced) return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      const matchNo = (inv.invoiceNo || '').toLowerCase().includes(q);
      const matchParty = (inv.partyName || '').toLowerCase().includes(q);
      const matchGst = (inv.gstin || '').toLowerCase().includes(q);
      return matchNo || matchParty || matchGst;
    }
    return true;
  });

  const pendingCount = invoices.filter((i) => !i.tallySync?.synced).length;
  const syncedCount = invoices.filter((i) => i.tallySync?.synced).length;

  const handleSyncSingle = async (inv) => {
    setSyncingId(inv.id);
    setFeedback(null);
    try {
      const res = await api.syncInvoiceToTally(inv.id);
      if (res.success) {
        setFeedback({ type: 'success', text: `✅ Bill #${inv.invoiceNo} pushed to Tally Prime Sales Register!` });
      } else {
        setFeedback({ type: 'error', text: `⚠️ ${res.error || res.message}` });
      }
      if (onRefreshInvoices) onRefreshInvoices();
    } catch (err) {
      setFeedback({ type: 'error', text: `Tally connection failed: ${err.message}` });
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
    <div className="bill-list-container" style={{ maxWidth: '1100px', margin: '0 auto', padding: '16px 20px 40px' }}>
      {/* 1. Voucher Sequence & KPI Banner */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '12px',
        marginBottom: '18px'
      }}>
        <div style={{ background: 'var(--bg-card)', padding: '14px 18px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Latest Voucher Created
          </div>
          <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--primary-ink)', marginTop: '4px' }}>
            {latestInvoiceNo || 'None Yet (Fresh)'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {latestInvoiceNo ? `Max voucher recorded: #${maxNum}` : 'Ready for first bill'}
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', padding: '14px 18px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Next Auto Voucher #
          </div>
          <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--success-ink)', marginTop: '4px' }}>
            {nextInvoiceNo}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            ⚡ Auto-incremented sequence
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', padding: '14px 18px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Tally Prime Sync
          </div>
          <div style={{ fontSize: '20px', fontWeight: 900, color: pendingCount === 0 ? 'var(--success-ink)' : 'var(--warning-ink)', marginTop: '4px' }}>
            {pendingCount === 0 ? '100% In Sync' : `${pendingCount} Pending`}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {syncedCount} of {invoices.length} vouchers in Tally
          </div>
        </div>
      </div>

      {/* Banner / Feedback */}
      {feedback && (
        <div className={`workbench-alert ${feedback.type}`} style={{ marginBottom: '14px' }}>
          {feedback.text}
        </div>
      )}

      {/* Top Filter & Search Bar */}
      <div className="directory-filter-bar" style={{ marginBottom: '16px' }}>
        <div className="search-input-wrap">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="directory-search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by invoice number, customer name, GSTIN..."
          />
          {search && (
            <button type="button" className="clear-btn" onClick={() => setSearch('')}>
              ✕
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="shipto-segmented-switch">
            <button
              type="button"
              className={`switch-segment ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All ({invoices.length})
            </button>
            <button
              type="button"
              className={`switch-segment ${filter === 'pending' ? 'active' : ''}`}
              onClick={() => setFilter('pending')}
            >
              Pending ({pendingCount})
            </button>
            <button
              type="button"
              className={`switch-segment ${filter === 'synced' ? 'active' : ''}`}
              onClick={() => setFilter('synced')}
            >
              Synced ({syncedCount})
            </button>
          </div>

          {pendingCount > 0 && (
            <button
              type="button"
              className="btn-sync-tally-pill"
              disabled={batchSyncing}
              onClick={handleSyncAll}
              style={{ fontSize: '11.5px', padding: '6px 12px' }}
            >
              {batchSyncing ? 'Syncing...' : `⚡ Sync ${pendingCount} to Tally`}
            </button>
          )}
        </div>
      </div>

      {/* Invoices List - Clean Table */}
      <div className="directory-table-card">
        {filtered.length === 0 ? (
          <div className="directory-empty-state">
            <span className="empty-icon">📄</span>
            <h4>No invoices found</h4>
            <p>Try clearing your search query or click "+ Create Bill" to generate a new sales invoice.</p>
          </div>
        ) : (
          <div className="table-responsive-wrapper">
            <table className="directory-data-table">
              <thead>
                <tr>
                  <th style={{ width: '130px' }}>Invoice No</th>
                  <th style={{ width: '100px' }}>Date</th>
                  <th style={{ minWidth: '220px' }}>Customer / Buyer</th>
                  <th style={{ width: '130px' }}>GSTIN</th>
                  <th style={{ width: '130px', textAlign: 'right' }}>Total (₹)</th>
                  <th style={{ width: '120px', textAlign: 'center' }}>Tally Status</th>
                  <th style={{ width: '160px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => {
                  const isSynced = Boolean(inv.tallySync?.synced);
                  return (
                    <tr key={inv.id} className="customer-row">
                      <td>
                        <strong
                          style={{ color: 'var(--primary-ink)', cursor: 'pointer', fontSize: '13px' }}
                          onClick={() => onViewInvoice(inv)}
                          title="Click to view Tax Invoice"
                        >
                          {inv.invoiceNo}
                        </strong>
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                        {inv.date}
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{inv.partyName}</div>
                        {inv.shipTo?.name && inv.shipTo.name !== inv.partyName && (
                          <div style={{ fontSize: '10.5px', color: 'var(--success-ink)' }}>
                            Ship To: {inv.shipTo.name}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`gstin-badge ${inv.gstin ? 'active' : 'unregistered'}`}>
                          {inv.gstin || 'Unregistered'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--text-main)', fontSize: '13.5px' }}>
                        {formatINR(inv.grandTotal)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span
                          className="state-badge"
                          style={{
                            background: isSynced ? 'var(--success-light)' : 'var(--warning-light)',
                            color: isSynced ? 'var(--success-ink)' : 'var(--warning-ink)',
                            borderColor: isSynced ? 'var(--success-border)' : 'var(--warning-border)',
                            fontWeight: 700,
                            fontSize: '11px'
                          }}
                        >
                          {isSynced ? '✓ Synced' : '⏳ Pending'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn-view-cust-details"
                            onClick={() => onViewInvoice(inv)}
                            title="View and print Tax Invoice"
                          >
                            👁️ View
                          </button>

                          <button
                            type="button"
                            className="btn-view-cust-details"
                            onClick={() => onEditInvoice && onEditInvoice(inv)}
                            style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)', borderColor: 'var(--border-medium)' }}
                            title="Edit this invoice"
                          >
                            ✏️ Edit
                          </button>

                          {!isSynced && (
                            <button
                              type="button"
                              className="btn-view-cust-details"
                              disabled={syncingId === inv.id}
                              onClick={() => handleSyncSingle(inv)}
                              style={{ background: 'var(--success-light)', color: 'var(--success-ink)', borderColor: 'var(--success-border)' }}
                              title="Push to Tally Prime Sales Day Book"
                            >
                              {syncingId === inv.id ? '...' : '⚡ Push'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
