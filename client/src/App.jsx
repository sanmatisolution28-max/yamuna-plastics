import React, { useState, useEffect } from 'react';
import BillForm from './components/BillForm';
import BillList from './components/BillList';
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

  const [activeTab, setActiveTab] = useState('new-bill'); // new-bill | invoices | parties | items | profilefile
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

  // The one and only sync control in the app. It used to exist as five
  // separate buttons (Create Bill, Customers, Bills list, and two on the
  // Tally Sync page) all calling different endpoints. The bridge's SYNC_ALL
  // command already pulls masters and pushes pending bills in one pass, so
  // every one of those collapsed into this single call.
  const [syncing, setSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState(null);

  const handleSyncAll = async () => {
    setSyncing(true);
    setSyncNotice(null);
    try {
      const res = await api.triggerUniversalTallySync();
      if (res.success) {
        const pushed = res.syncedCount != null ? ` ${res.syncedCount} bill(s) pushed.` : '';
        setSyncNotice({
          type: 'success',
          text: `${res.message || 'Synced with Tally Prime.'}${pushed}`
        });
      } else {
        setSyncNotice({ type: 'warning', text: res.error || res.message || 'Tally Prime did not respond.' });
      }
      await loadData();
    } catch (err) {
      setSyncNotice({ type: 'warning', text: err.message || 'Could not reach Tally Prime on port 9000.' });
    } finally {
      setSyncing(false);
    }
  };

  // Clear a stale banner as soon as the operator starts a different task.
  useEffect(() => {
    if (syncNotice) setSyncNotice(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // If not logged in, show secure login page
  if (!currentUser) {
    return <LoginModal onLoginSuccess={(u) => setCurrentUser(u)} />;
  }

  // Every page gets its own accent hue. Setting one class on the workspace
  // wrapper is enough: the CSS derives the tints, borders and card strips
  // from --accent, so the whole screen shifts colour together instead of
  // each component inventing its own.
  const PAGE_ACCENT = {
    'new-bill': 'accent-primary',
    invoices: 'accent-primary',
    parties: 'accent-teal',
    items: 'accent-amber',
    profile: 'accent-purple'
  };

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
              className="status-pill latest-bill-pill"
              onClick={() => setActiveTab('invoices')}
              title={`Latest created bill: ${latestInvoiceNo || 'None yet'} | Next auto bill: ${nextInvoiceNo}`}
            >
              <span className="pill-icon">🧾</span>
              <span className="pill-label">Latest Bill:</span>
              <strong className={latestInvoiceNo ? 'pill-value' : 'pill-value empty'}>
                {latestInvoiceNo || 'None Yet'}
              </strong>
              <span className="pill-next">Next: #{nextSeq}</span>
            </div>

            {/* Read-only connection indicator. Clicking it goes to Settings,
                where the Tally connection test and setup live. */}
            <div
              className={`status-pill ${tallyOnline ? 'online' : 'standby'}`}
              onClick={() => setActiveTab('profile')}
              title={tallyOnline ? `Connected to ${activeCompany} on Port 9000` : 'Tally on Standby (Port 9000) - open Settings to test the connection'}
            >
              <span className={`status-indicator-dot ${tallyOnline ? '' : 'offline'}`}></span>
              <span>{tallyOnline ? `Tally: ${activeCompany}` : 'Tally Standby (Port 9000)'}</span>
            </div>
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
              className="btn-refresh"
              onClick={loadData}
              disabled={refreshing}
              title="Refresh all data"
              aria-label="Refresh all data"
            >
              <span aria-hidden="true">{refreshing ? '⏳' : '🔄'}</span>
            </button>

            {/* The single sync control for the whole portal. */}
            <button
              type="button"
              className="btn-sync-global"
              onClick={handleSyncAll}
              disabled={syncing}
              title="Pull customers and products from Tally Prime, and push all pending bills"
            >
              <span aria-hidden="true">{syncing ? '⏳' : '🔄'}</span>
              <span className="btn-label-desktop">
                {syncing ? 'Syncing…' : pendingCount > 0 ? `Sync ${pendingCount} to Tally` : 'Sync Tally'}
              </span>
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

      {/* Result of the single global sync, shown once above whichever page the
          operator is on so the outcome is never buried in a list. */}
      {syncNotice && (
        <div className={`global-sync-notice ${syncNotice.type}`} role="status">
          <span>{syncNotice.text}</span>
          <button
            type="button"
            className="global-sync-notice-close"
            onClick={() => setSyncNotice(null)}
            aria-label="Dismiss sync message"
          >
            ×
          </button>
        </div>
      )}

      {/* Main Page Workspace */}
      <main className={`app-workspace ${PAGE_ACCENT[activeTab] || 'accent-primary'}`}>
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
