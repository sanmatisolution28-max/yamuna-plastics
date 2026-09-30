const API_BASE = '/api';

export const api = {
  // Invoices
  getInvoices: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/invoices${query ? '?' + query : ''}`);
    if (!res.ok) throw new Error('Failed to fetch invoices');
    return res.json();
  },

  getInvoice: async (id) => {
    const res = await fetch(`${API_BASE}/invoices/${id}`);
    if (!res.ok) throw new Error('Invoice not found');
    return res.json();
  },

  createInvoice: async (data) => {
    const res = await fetch(`${API_BASE}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to generate invoice');
    }
    return res.json();
  },

  updateInvoice: async (id, data) => {
    const res = await fetch(`${API_BASE}/invoices/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update invoice');
    }
    return res.json();
  },

  deleteInvoice: async (id) => {
    const res = await fetch(`${API_BASE}/invoices/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete invoice');
    return res.json();
  },

  getNextInvoiceNumber: async () => {
    const res = await fetch(`${API_BASE}/invoices/next-number`);
    if (!res.ok) throw new Error('Failed to fetch next invoice number');
    return res.json();
  },

  // Masters
  getParties: async () => {
    const res = await fetch(`${API_BASE}/parties`);
    if (!res.ok) throw new Error('Failed to fetch parties');
    return res.json();
  },

  createParty: async (party) => {
    const res = await fetch(`${API_BASE}/parties`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(party)
    });
    if (!res.ok) throw new Error('Failed to save party');
    return res.json();
  },

  getItems: async () => {
    const res = await fetch(`${API_BASE}/items`);
    if (!res.ok) throw new Error('Failed to fetch products');
    return res.json();
  },

  createItem: async (item) => {
    const res = await fetch(`${API_BASE}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item)
    });
    if (!res.ok) throw new Error('Failed to save product');
    return res.json();
  },

  getSettings: async () => {
    const res = await fetch(`${API_BASE}/settings`);
    if (!res.ok) throw new Error('Failed to fetch settings');
    return res.json();
  },

  updateSettings: async (data) => {
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to update settings');
    return res.json();
  },

  // Tally Integration
  getTallyStatus: async () => {
    const res = await fetch(`${API_BASE}/tally/status`);
    if (!res.ok) throw new Error('Failed to query Tally status');
    return res.json();
  },

  syncInvoiceToTally: async (id) => {
    const res = await fetch(`${API_BASE}/tally/sync/${id}`, { method: 'POST' });
    return res.json();
  },

  syncAllToTally: async () => {
    const res = await fetch(`${API_BASE}/tally/sync-all`, { method: 'POST' });
    return res.json();
  },

  fetchEwayBill: async (id) => {
    const res = await fetch(`${API_BASE}/tally/fetch-eway-bill/${id}`, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch e-Way Bill');
    }
    return res.json();
  },

  testEwayBillConnection: async () => {
    const res = await fetch(`${API_BASE}/tally/test-eway-connection`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to test e-Way Bill connection');
    return res.json();
  },

  syncAllEwayBills: async () => {
    const res = await fetch(`${API_BASE}/tally/sync-all-eway-bills`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to sync all e-Way Bills');
    return res.json();
  },

  getTallyExportXmlUrl: (all = false) => {
    return `${API_BASE}/tally/export-xml?all=${all}`;
  },

  // Authentication
  login: async (credentials) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Login failed');
    }
    return data;
  },

  getProfile: async () => {
    const res = await fetch(`${API_BASE}/auth/profile`);
    return res.json();
  },

  changePassword: async (passwords) => {
    const res = await fetch(`${API_BASE}/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(passwords)
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to update password');
    }
    return data;
  },

  // Masters Sync
  importTallyMastersXml: async (xml) => {
    const res = await fetch(`${API_BASE}/masters/import-tally-xml`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ xml })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to import Tally masters');
    }
    return data;
  },

  fetchMastersFromTally: async () => {
    const res = await fetch(`${API_BASE}/masters/fetch-from-tally`, {
      method: 'POST'
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to fetch masters from Tally');
    }
    return data;
  },

  // 1-Click Universal Tally Sync (works seamlessly both on local PC and live cloud)
  triggerUniversalTallySync: async () => {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocal) {
      return api.fetchMastersFromTally();
    }

    // Trigger Cloud Bridge Command
    const triggerRes = await fetch(`${API_BASE}/bridge/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'SYNC_ALL' })
    });

    if (!triggerRes.ok) {
      throw new Error('Failed to initiate sync request with Tally Bridge.');
    }

    const triggerData = await triggerRes.json();
    const commandId = triggerData.commandId;

    // Poll for local PC agent to complete the sync (up to 14 seconds)
    const startTime = Date.now();
    while (Date.now() - startTime < 14000) {
      await new Promise((r) => setTimeout(r, 800));
      try {
        const statusRes = await fetch(`${API_BASE}/bridge/status/${commandId}`);
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          if (statusData.status === 'COMPLETED') {
            return {
              success: true,
              message: statusData.result?.message || 'Tally Masters & Bills synchronized directly with Tally Prime!',
              totalParties: statusData.result?.totalParties,
              totalItems: statusData.result?.totalItems
            };
          } else if (statusData.status === 'FAILED') {
            throw new Error(statusData.error || 'Tally rejected synchronization request.');
          }
        }
      } catch (pollErr) {
        if (pollErr.message && !pollErr.message.includes('fetch')) throw pollErr;
      }
    }

    // Direct loopback fallback to local agent port with Private Network Access
    try {
      const directRes = await fetch('http://127.0.0.1:5005/api/masters/fetch-from-tally', {
        method: 'POST',
        signal: AbortSignal.timeout(3000)
      });
      const directData = await directRes.json();
      if (directData.success) return directData;
    } catch {}

    throw new Error('Tally Prime connection timed out. Ensure Tally Prime is open on your PC.');
  }
};
