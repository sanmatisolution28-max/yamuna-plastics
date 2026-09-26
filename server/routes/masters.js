import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');
const PARTIES_FILE = path.join(DATA_DIR, 'parties.json');
const ITEMS_FILE = path.join(DATA_DIR, 'items.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

const router = express.Router();

async function readJson(file, fallback = []) {
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJson(file, data) {
  await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf8');
}

// Parties / Customers
router.get('/parties', async (req, res) => {
  try {
    const parties = await readJson(PARTIES_FILE, []);
    res.json(parties);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/parties', async (req, res) => {
  try {
    const parties = await readJson(PARTIES_FILE, []);
    const newParty = {
      id: `PART-${Date.now()}`,
      name: req.body.name || 'New Customer',
      contactPerson: req.body.contactPerson || '',
      phone: req.body.phone || '',
      email: req.body.email || '',
      address: req.body.address || '',
      city: req.body.city || '',
      state: req.body.state || 'Gujarat',
      stateCode: req.body.stateCode || (req.body.gstin ? req.body.gstin.slice(0, 2) : '24'),
      pincode: req.body.pincode || '',
      gstin: req.body.gstin || '',
      pan: req.body.pan || (req.body.gstin ? req.body.gstin.slice(2, 12) : ''),
      creditDays: Number(req.body.creditDays || 30),
      openingBalance: Number(req.body.openingBalance || 0)
    };
    parties.push(newParty);
    await writeJson(PARTIES_FILE, parties);
    res.status(201).json(newParty);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Items / Plastics Catalog
router.get('/items', async (req, res) => {
  try {
    const items = await readJson(ITEMS_FILE, []);
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/items', async (req, res) => {
  try {
    const items = await readJson(ITEMS_FILE, []);
    const newItem = {
      id: `ITEM-${Date.now()}`,
      name: req.body.name || 'New Plastic Item',
      description: req.body.description || '',
      hsn: req.body.hsn || '39232100',
      unit: req.body.unit || 'KGS',
      baseRate: Number(req.body.baseRate || 100),
      gstRate: Number(req.body.gstRate || 18),
      stockQty: Number(req.body.stockQty || 0),
      category: req.body.category || 'General'
    };
    items.push(newItem);
    await writeJson(ITEMS_FILE, items);
    res.status(201).json(newItem);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Settings / Company & Tally config
router.get('/settings', async (req, res) => {
  try {
    const settings = await readJson(SETTINGS_FILE, {});
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/settings', async (req, res) => {
  try {
    const current = await readJson(SETTINGS_FILE, {});
    const updated = {
      ...current,
      ...req.body,
      company: { ...(current.company || {}), ...(req.body.company || {}) },
      tally: { ...(current.tally || {}), ...(req.body.tally || {}) },
      ewayBill: { ...(current.ewayBill || {}), ...(req.body.ewayBill || {}) }
    };
    await writeJson(SETTINGS_FILE, updated);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
