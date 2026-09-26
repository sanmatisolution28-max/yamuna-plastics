import React, { useState, useEffect } from 'react';
import BillForm from './components/BillForm';
import BillList from './components/BillList';
import TallySync from './components/TallySync';
import PartyMaster from './components/PartyMaster';
import ItemCatalog from './components/ItemCatalog';
import InvoiceModal from './components/InvoiceModal';
import { api } from './utils/api';
import { formatINR } from './utils/numberToWords';

export default function App() {
  const [activeTab, setActiveTab] = useState('new-bill'); // new-bill | invoices | tally | parties | items
  const [invoices, setInvoices] = useState([]);
  const [parties, setParties] = useState([]);
  const [items, setItems] = useState([]);
  const [settings, setSettings] = useState(null);
  const [tallyOnline, setTallyOnline] = useState(false);
  const [activeCompany, setActiveCompany] = useState('Sanmati Solution');
  const [viewingInvoice, setViewingInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Load all initial data from server
  const loadData = async () => {
    try {
      setRefreshing(true);
      const [invList, partyList, itemList, cfg] = await Promise.all([
        api.getInvoices().catch(() => []),
        api.getParties().catch(() => []),
        api.getItems().catch(() => []),
        api.getSettings().catch(() => ({}))
      ]);
      setInvoices(invList);
      setParties(partyList);
      setItems(itemList);
      setSettings(cfg);

      // Check Tally status
      const tStat = await api.getTallyStatus().catch(() => ({ online: false }));
      setTallyOnline(Boolean(tStat?.online));
      if (tStat?.activeCompany || tStat?.configuredCompany) {
        setActiveCompany(tStat.activeCompany || tStat.configuredCompany);
      }
    } catch (err) {
      console.error('Initialization error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    // Poll Tally status every 15 seconds
    const interval = setInterval(async () => {
      const tStat = await api.getTallyStatus().catch(() => ({ online: false }));
      setTallyOnline(Boolean(tStat?.online));
      if (tStat?.activeCompany || tStat?.configuredCompany) {
        setActiveCompany(tStat.activeCompany || tStat.configuredCompany);
      }
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleBillGenerated = (savedInv) => {
    setInvoices((prev) => {
      const exists = prev.some((i) => i.id === savedInv.id);
      if (exists) {
        return prev.map((i) => (i.id === savedInv.id ? savedInv : i));
      }
      return [savedInv, ...prev];
    });
    setEditingInvoice(null);
    setViewingInvoice(savedInv);
  };

  const handleEditInvoice = (inv) => {
    setEditingInvoice(inv);
    setActiveTab('new-bill');
  };

  const handleInvoiceSynced = (invId) => {
    setInvoices((prev) =>
      prev.map((i) =>
        i.id === invId
          ? {
              ...i,
              tallySync: {
                synced: true,
                syncTime: new Date().toISOString(),
                tallyVoucherNo: i.invoiceNo,
                method: 'Direct Push'
              }
            }
          : i
      )
    );
  };

  // Compute live KPI metrics
  const totalBillsCount = invoices.length;
  const pendingCount = invoices.filter((i) => !i.tallySync?.synced).length;
  const syncedCount = totalBillsCount - pendingCount;
  const totalRevenue = invoices.reduce((acc, inv) => acc + Number(inv.grandTotal || 0), 0);
  const ewbCount = invoices.filter((i) => Boolean(i.ewayBill?.ewayBillNo || i.ewayBillNo)).length;

  return (
    <div className="app-container">
      {/* 1. Top Executive Navigation Bar */}
      <header className="app-navbar">
        <div className="navbar-inner">
          {/* Brand Logo & Title */}
          <div className="brand-section">
            <div className="brand-logo-icon">🏭</div>
            <div className="brand-text">
              <h1>
                Yamuna Plastics
                <span className="version-tag">Enterprise v2.0</span>
              </h1>
              <p>Mobile Billing &amp; Tally Prime Integration Engine</p>
            </div>
          </div>

          {/* System Connectivity & Status Pills */}
          <div className="system-status-group">
            <div className="status-pill" title="Tally Prime HTTP Server Status on Port 9000">
              <span className={`status-indicator-dot ${tallyOnline ? '' : 'offline'}`}></span>
              <span>{tallyOnline ? `Tally Prime: ${activeCompany}` : 'Tally Standby (Port 9000)'}</span>
            </div>

            <div className="status-pill" title="e-Way Bill Auto-Generation Mode">
              <span>🚚 EWB: Option 1 (Auto)</span>
            </div>

            {pendingCount > 0 && (
              <div
                className="pending-alert-badge"
                onClick={() => setActiveTab('tally')}
                title="Click to view and sync pending bills with Tally"
              >
                <span>⚡ {pendingCount} Pending Tally Sync</span>
              </div>
            )}
          </div>

          {/* Navbar Quick Action Buttons */}
          <div className="navbar-actions">
            <button
              type="button"
              className="btn-nav-secondary"
              onClick={loadData}
              disabled={refreshing}
              title="Refresh all invoices and Tally connection"
            >
              {refreshing ? '⏳ Refreshing...' : '🔄 Refresh'}
            </button>

            <button
              type="button"
              className="btn-nav-primary"
              onClick={() => {
                setEditingInvoice(null);
                setActiveTab('new-bill');
              }}
            >
              <span>+ Create Bill</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. KPI Metrics Ribbon (Interactive Dashboard Strip) */}
      <section className="kpi-banner">
        <div className="kpi-inner">
          <div className="kpi-card" onClick={() => setActiveTab('invoices')}>
            <div className="kpi-icon-wrap blue">📋</div>
            <div className="kpi-content">
              <span className="kpi-label">Total Invoices</span>
              <span className="kpi-value">{totalBillsCount} Bills</span>
              <span className="kpi-sub">All sales vouchers recorded</span>
            </div>
          </div>

          <div className="kpi-card" onClick={() => setActiveTab('invoices')}>
            <div className="kpi-icon-wrap green">💰</div>
            <div className="kpi-content">
              <span className="kpi-label">Total Billed Revenue</span>
              <span className="kpi-value">{formatINR(totalRevenue)}</span>
              <span className="kpi-sub">Inclusive of CGST / SGST</span>
            </div>
          </div>

          <div className="kpi-card" onClick={() => setActiveTab('tally')}>
            <div className={`kpi-icon-wrap ${pendingCount > 0 ? 'amber' : 'green'}`}>🔌</div>
            <div className="kpi-content">
              <span className="kpi-label">Tally Sync Status</span>
              <span className="kpi-value">
                {syncedCount} / {totalBillsCount} Synced
              </span>
              <span className="kpi-sub">
                {pendingCount > 0 ? `${pendingCount} pending Day Book push` : '100% Up to date in Tally'}
              </span>
            </div>
          </div>

          <div className="kpi-card" onClick={() => setActiveTab('invoices')}>
            <div className="kpi-icon-wrap purple">🚚</div>
            <div className="kpi-content">
              <span className="kpi-label">e-Way Bills</span>
              <span className="kpi-value">{ewbCount} Generated</span>
              <span className="kpi-sub">Option 1: 100% Auto-Compliant</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Modern Segmented Tab Navigation */}
      <nav className="tabs-container">
        <div className="tabs-inner">
          <button
            type="button"
            className={`tab-button ${activeTab === 'new-bill' ? 'active' : ''}`}
            onClick={() => {
              setEditingInvoice(null);
              setActiveTab('new-bill');
            }}
          >
            <span>📝</span>
            <span>{editingInvoice ? 'Edit Bill' : 'Create New Bill'}</span>
          </button>

          <button
            type="button"
            className={`tab-button ${activeTab === 'invoices' ? 'active' : ''}`}
            onClick={() => setActiveTab('invoices')}
          >
            <span>📋</span>
            <span>Bills &amp; Invoices</span>
            <span className="tab-badge">{invoices.length}</span>
          </button>

          <button
            type="button"
            className={`tab-button ${activeTab === 'tally' ? 'active' : ''}`}
            onClick={() => setActiveTab('tally')}
          >
            <span>🔌</span>
            <span>Tally Prime Sync</span>
            {pendingCount > 0 && <span className="tab-badge warning">{pendingCount}</span>}
          </button>

          <button
            type="button"
            className={`tab-button ${activeTab === 'parties' ? 'active' : ''}`}
            onClick={() => setActiveTab('parties')}
          >
            <span>👥</span>
            <span>Customers &amp; Parties</span>
            <span className="tab-badge">{parties.length}</span>
          </button>

          <button
            type="button"
            className={`tab-button ${activeTab === 'items' ? 'active' : ''}`}
            onClick={() => setActiveTab('items')}
          >
            <span>📦</span>
            <span>Stock Catalog</span>
            <span className="tab-badge">{items.length}</span>
          </button>
        </div>
      </nav>

      {/* 4. Main Workspace */}
      <main className="app-workspace">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: '#64748b' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>⏳</div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#1e293b' }}>
              Loading Yamuna Plastics Enterprise Data...
            </div>
            <div style={{ fontSize: '13px', marginTop: '4px' }}>Connecting to local API and Tally Prime...</div>
          </div>
        ) : (
          <>
            {activeTab === 'new-bill' && (
              <BillForm
                parties={parties}
                items={items}
                settings={settings}
                editingInvoice={editingInvoice}
                onCancelEdit={() => setEditingInvoice(null)}
                onBillGenerated={handleBillGenerated}
                onViewInvoice={(inv) => setViewingInvoice(inv)}
              />
            )}

            {activeTab === 'invoices' && (
              <BillList
                invoices={invoices}
                onViewInvoice={(inv) => setViewingInvoice(inv)}
                onEditInvoice={handleEditInvoice}
                onRefreshInvoices={loadData}
              />
            )}

            {activeTab === 'tally' && (
              <TallySync
                invoices={invoices}
                settings={settings}
                onRefreshInvoices={loadData}
              />
            )}

            {activeTab === 'parties' && (
              <PartyMaster
                parties={parties}
                onPartyAdded={(p) => setParties((prev) => [...prev, p])}
              />
            )}

            {activeTab === 'items' && (
              <ItemCatalog
                items={items}
                onItemAdded={(it) => setItems((prev) => [...prev, it])}
              />
            )}
          </>
        )}
      </main>

      {/* 5. 1:1 Pixel-Perfect Tax Invoice Modal (Replicating 186 instaplast.pdf) */}
      {viewingInvoice && (
        <InvoiceModal
          invoice={viewingInvoice}
          settings={settings}
          onClose={() => setViewingInvoice(null)}
          onSynced={handleInvoiceSynced}
        />
      )}
    </div>
  );
}
