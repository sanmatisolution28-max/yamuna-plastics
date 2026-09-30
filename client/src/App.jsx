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
  const [preselectedPartyId, setPreselectedPartyId] = useState('');
  const [refreshing, setRefreshing] = useState(false);

// Light / dark theme. The initial value is read from the document, which the
// inline script in index.html has already set before React mounts (so there is
// no flash of the wrong theme), defaulting to the OS preference.
const [theme, setTheme] = useState(() => {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
});

const toggleTheme = () => {
  setTheme((prev) => {
    const next = prev === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { window.localStorage.setItem('yamuna.theme', next); } catch { /* private mode */ }
    return next;
  });
};

// Keep the document in step if anything else changes the attribute.
useEffect(() => {
  document.documentElement.setAttribute('data-theme', theme);
  try { window.localStorage.setItem('yamuna.theme', theme); } catch { /* private mode */ }
}, [theme]);

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
    // Continuous background poll every 10 seconds for Tally status, invoices, customers, and product catalog updates
    const interval = setInterval(async () => {
      try {
        const [tStat, freshSettings, freshInvoices, freshParties, freshItems] = await Promise.all([
          api.getTallyStatus().catch(() => ({ online: false })),
          api.getSettings().catch(() => null),
          api.getInvoices().catch(() => null),
          api.getParties().catch(() => null),
          api.getItems().catch(() => null)
        ]);
        setTallyOnline(Boolean(tStat?.online));
        if (tStat?.activeCompany || tStat?.configuredCompany) {
          setActiveCompany(tStat.activeCompany || tStat.configuredCompany);
        }
        if (freshSettings) setSettings(freshSettings);
        if (freshInvoices && Array.isArray(freshInvoices)) setInvoices(freshInvoices);
        if (freshParties && Array.isArray(freshParties)) setParties(freshParties);
        if (freshItems && Array.isArray(freshItems)) setItems(freshItems);
      } catch {
        // Quiet poll error
      }
    }, 10000);
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

  // Compute live KPI metrics & latest voucher numbering
  const totalBillsCount = invoices.length;
  const pendingCount = invoices.filter((i) => !i.tallySync?.synced).length;
  const syncedCount = totalBillsCount - pendingCount;
  const totalRevenue = invoices.reduce((acc, inv) => acc + Number(inv.grandTotal || 0), 0);
  const ewbCount = invoices.filter((i) => Boolean(i.ewayBill?.ewayBillNo || i.ewayBillNo)).length;

  let maxVoucherNum = 0;
  let latestInvoiceNo = null;
  for (const inv of invoices) {
    const match = String(inv.invoiceNo || '').match(/(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxVoucherNum) {
        maxVoucherNum = num;
        latestInvoiceNo = inv.invoiceNo;
      }
    }
  }
  const prefix = settings?.invoicePrefix || 'YP/26-27/';
  const configuredNext = Number(settings?.nextInvoiceNumber);
  if (!latestInvoiceNo && configuredNext && configuredNext > 1) {
    maxVoucherNum = configuredNext - 1;
    latestInvoiceNo = `${prefix}${maxVoucherNum}`;
  }
  const nextSeq = Math.max(configuredNext || 1, maxVoucherNum + 1);
  const nextInvoiceNo = `${prefix}${nextSeq}`;

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
            {/* Prominent Latest Bill Number Indicator at the very top */}
            <div
              className="status-pill"
              style={{
                background: 'var(--bg-card)',
                border: '1.5px solid var(--border-medium)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                padding: '5px 12px',
                borderRadius: '20px',
                fontWeight: 700
              }}
              onClick={() => setActiveTab('invoices')}
              title={`Latest created bill: ${latestInvoiceNo || 'None yet'} | Next auto bill: ${nextInvoiceNo}`}
            >
              <span style={{ fontSize: '13px' }}>🧾</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Latest Bill:</span>
              <strong style={{ color: latestInvoiceNo ? 'var(--primary-ink)' : 'var(--text-secondary)', fontSize: '13px' }}>
                {latestInvoiceNo || 'None Yet'}
              </strong>
              <span
                style={{
                  fontSize: '10px',
                  padding: '2px 7px',
                  borderRadius: '10px',
                  background: 'var(--success-light)',
                  color: 'var(--success-ink)',
                  border: '1px solid currentColor',
                  fontWeight: 800,
                  marginLeft: '2px'
                }}
              >
                Next: #{nextSeq}
              </span>
            </div>

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
              className="btn-theme-toggle"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              <span className="theme-toggle-icon" aria-hidden="true">
                {theme === 'dark' ? '☀️' : '🌙'}
              </span>
              <span className="btn-label-desktop">{theme === 'dark' ? 'Light' : 'Dark'}</span>
            </button>

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
            <span className="tab-text">Products</span>
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

      {/* Main Page Workspace */}
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
                invoices={invoices}
                settings={settings}
                editingInvoice={editingInvoice}
                preselectedPartyId={preselectedPartyId}
                onCancelEdit={() => setEditingInvoice(null)}
                onBillGenerated={handleBillGenerated}
                onViewInvoice={(inv) => setViewingInvoice(inv)}
                onRefresh={loadData}
              />
            )}

            {activeTab === 'invoices' && (
              <BillList
                invoices={invoices}
                settings={settings}
                onViewInvoice={(inv) => setViewingInvoice(inv)}
                onEditInvoice={handleEditInvoice}
                onRefreshInvoices={loadData}
              />
            )}

            {activeTab === 'tally' && (
              <TallySync
                invoices={invoices}
                parties={parties}
                items={items}
                settings={settings}
                onRefreshInvoices={loadData}
              />
            )}

            {activeTab === 'parties' && (
              <PartyMaster
                parties={parties}
                onPartyAdded={(p) => setParties((prev) => [...prev, p])}
                onRefresh={loadData}
                onSelectForBill={(partyId) => {
                  setPreselectedPartyId(partyId);
                  setEditingInvoice(null);
                  setActiveTab('new-bill');
                }}
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
