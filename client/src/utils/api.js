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
  }
};
