import React, { useState, useEffect } from 'react';
import BillForm from './components/BillForm';
import BillList from './components/BillList';
import TallySync from './components/TallySync';
import PartyMaster from './components/PartyMaster';
import ItemCatalog from './components/ItemCatalog';
import InvoiceModal from './components/InvoiceModal';
import LoginModal from './components/LoginModal';
import ProfilePage from './components/ProfilePage';
import { api } from './utils/api';
import { formatINR } from './utils/numberToWords';

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('yp_user');
      const token = localStorage.getItem('yp_auth_token');
      return saved && token ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [activeTab, setActiveTab] = useState('new-bill'); // new-bill | invoices | tally | parties | items | profile
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

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to sign out of Yamuna Plastics Portal?')) {
      localStorage.removeItem('yp_auth_token');
      localStorage.removeItem('yp_user');
      setCurrentUser(null);
    }
  };

  // If not logged in, show secure login page
  if (!currentUser) {
    return <LoginModal onLoginSuccess={(u) => setCurrentUser(u)} />;
  }

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
          <div
            className="brand-section"
            onClick={() => setActiveTab('invoices')}
            style={{ cursor: 'pointer' }}
            title="Yamuna Plastics Portal Home"
          >
            <div className="brand-logo-icon">🏭</div>
            <div className="brand-text">
              <h1>
                Yamuna Plastics
                <span className="version-tag">Cloud Portal</span>
              </h1>
              <p>Mobile Billing &amp; Tally Prime Integration</p>
            </div>
          </div>

          {/* Center Connectivity & Quick Info */}
          <div className="system-status-group">
            <div
              className={`status-pill ${tallyOnline ? 'online' : 'standby'}`}
              onClick={() => setActiveTab('tally')}
              title={tallyOnline ? `Connected to ${activeCompany} on Port 9000` : 'Tally on Standby (Port 9000)'}
            >
              <span className={`status-indicator-dot ${tallyOnline ? '' : 'offline'}`}></span>
              <span>{tallyOnline ? `Tally: ${activeCompany}` : 'Tally Standby (Port 9000)'}</span>
            </div>

            {pendingCount > 0 && (
              <div
                className="pending-alert-badge"
                onClick={() => setActiveTab('tally')}
                title="Click to view and sync pending bills with Tally"
              >
                <span>⚡ {pendingCount} Pending Sync</span>
              </div>
            )}
          </div>

          {/* Right Action Controls */}
          <div className="navbar-actions">
            <button
              type="button"
              className="btn-nav-secondary"
              onClick={loadData}
              disabled={refreshing}
              title="Refresh all data"
            >
              {refreshing ? '⏳' : '🔄'}
              <span className="btn-label-desktop">Refresh</span>
            </button>

            <button
              type="button"
              className={`btn-nav-primary ${activeTab === 'new-bill' ? 'active-pulse' : ''}`}
              onClick={() => {
                setEditingInvoice(null);
                setActiveTab('new-bill');
              }}
            >
              <span>+ Create Bill</span>
            </button>

            {/* Dedicated Profile & Account Button */}
            <div
              className={`user-profile-badge ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
              title="Open Profile, Password & Settings Page"
            >
              <span className="user-avatar">👤</span>
              <div className="user-info-text">
                <span className="user-name">{currentUser?.name || currentUser?.username || 'Admin'}</span>
                <span className="user-role">{currentUser?.role || 'Super Admin'}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 2. Modern Segmented Tab Navigation Bar */}
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
            <span className="tab-icon">📝</span>
            <span className="tab-text">{editingInvoice ? 'Edit Bill' : 'Create New Bill'}</span>
          </button>

          <button
            type="button"
            className={`tab-button ${activeTab === 'invoices' ? 'active' : ''}`}
            onClick={() => setActiveTab('invoices')}
          >
            <span className="tab-icon">📋</span>
            <span className="tab-text">Bills &amp; Invoices</span>
            <span className="tab-badge">{invoices.length}</span>
          </button>

          <button
            type="button"
            className={`tab-button ${activeTab === 'tally' ? 'active' : ''}`}
            onClick={() => setActiveTab('tally')}
          >
            <span className="tab-icon">🔌</span>
            <span className="tab-text">Tally Prime Sync</span>
            {pendingCount > 0 && <span className="tab-badge warning">{pendingCount}</span>}
          </button>

          <button
            type="button"
            className={`tab-button ${activeTab === 'parties' ? 'active' : ''}`}
            onClick={() => setActiveTab('parties')}
          >
            <span className="tab-icon">👥</span>
            <span className="tab-text">Customers</span>
            <span className="tab-badge">{parties.length}</span>
          </button>

          <button
            type="button"
            className={`tab-button ${activeTab === 'items' ? 'active' : ''}`}
            onClick={() => setActiveTab('items')}
          >
            <span className="tab-icon">📦</span>
            <span className="tab-text">Stock Items</span>
            <span className="tab-badge">{items.length}</span>
          </button>

          <button
            type="button"
            className={`tab-button ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <span className="tab-icon">👤</span>
            <span className="tab-text">Profile &amp; Settings</span>
          </button>
        </div>
      </nav>

      {/* 3. KPI Metrics Dashboard Strip (Shown on Invoices and Tally views for clean elegance) */}
      {(activeTab === 'invoices' || activeTab === 'tally') && (
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
                <span className="kpi-label">Total Revenue</span>
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
      )}

      {/* 4. Main Page Workspace */}
      <main className="app-workspace">
        {loading ? (
          <div className="loading-state-card">
            <div className="loading-spinner">⏳</div>
            <h3>Loading Yamuna Plastics Enterprise Data...</h3>
            <p>Connecting to local database and Tally Prime engine...</p>
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
                onRefresh={loadData}
              />
            )}

            {activeTab === 'items' && (
              <ItemCatalog
                items={items}
                onItemAdded={(it) => setItems((prev) => [...prev, it])}
                onRefresh={loadData}
              />
            )}

            {/* Dedicated Profile & Security Page */}
            {activeTab === 'profile' && (
              <ProfilePage
                user={currentUser}
                onLogout={handleLogout}
                settings={settings}
                onSettingsUpdated={(newCfg) => setSettings(newCfg)}
              />
            )}
          </>
        )}
      </main>

      {/* 5. 1:1 Pixel-Perfect Tax Invoice Modal */}
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
