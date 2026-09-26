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

// Import Tally Masters XML (Ledgers & Stock Items)
router.post('/masters/import-tally-xml', async (req, res) => {
  try {
    const xml = typeof req.body === 'string' ? req.body : (req.body.xml || '');
    if (!xml || !xml.trim()) {
      return res.status(400).json({ success: false, error: 'No XML content provided' });
    }

    const currentParties = await readJson(PARTIES_FILE, []);
    const currentItems = await readJson(ITEMS_FILE, []);

    let newPartiesCount = 0;
    let newItemsCount = 0;

    // 1. Parse Ledgers (Sundry Debtors)
    const ledgerRegex = /<LEDGER\s+NAME="([^"]+)"[^>]*>([\s\S]*?)<\/LEDGER>/gi;
    let lMatch;
    while ((lMatch = ledgerRegex.exec(xml)) !== null) {
      const name = lMatch[1].replace(/&amp;/g, '&').trim();
      const content = lMatch[2];

      // Extract GSTIN
      const gstinMatch = content.match(/<PARTYGSTIN>([^<]+)<\/PARTYGSTIN>/i);
      const gstin = gstinMatch ? gstinMatch[1].trim() : '';

      // Extract State
      const stateMatch = content.match(/<STATENAME>([^<]+)<\/STATENAME>/i);
      const state = stateMatch ? stateMatch[1].trim() : 'Gujarat';

      // Extract Address lines
      const addressLines = [];
      const addrRegex = /<ADDRESS>([^<]+)<\/ADDRESS>/gi;
      let aM;
      while ((aM = addrRegex.exec(content)) !== null) {
        addressLines.push(aM[1].replace(/&amp;/g, '&').trim());
      }

      // Check if already exists
      const existingIdx = currentParties.findIndex((p) => p.name.toLowerCase() === name.toLowerCase());
      if (existingIdx >= 0) {
        currentParties[existingIdx] = {
          ...currentParties[existingIdx],
          gstin: gstin || currentParties[existingIdx].gstin,
          state: state || currentParties[existingIdx].state,
          address: addressLines.join(', ') || currentParties[existingIdx].address
        };
      } else {
        currentParties.push({
          id: `PART-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          name,
          contactPerson: '',
          phone: '',
          email: '',
          address: addressLines.join(', ') || '',
          city: '',
          state,
          stateCode: gstin ? gstin.slice(0, 2) : '24',
          pincode: '',
          gstin,
          pan: gstin ? gstin.slice(2, 12) : '',
          creditDays: 30,
          openingBalance: 0
        });
        newPartiesCount++;
      }
    }

    // 2. Parse Stock Items
    const itemRegex = /<STOCKITEM\s+NAME="([^"]+)"[^>]*>([\s\S]*?)<\/STOCKITEM>/gi;
    let iMatch;
    while ((iMatch = itemRegex.exec(xml)) !== null) {
      const name = iMatch[1].replace(/&amp;/g, '&').trim();
      const content = iMatch[2];

      const hsnMatch = content.match(/<HSNCODE>([^<]+)<\/HSNCODE>/i) || content.match(/<HSNDETAILS>([^<]+)<\/HSNDETAILS>/i);
      const hsn = hsnMatch ? hsnMatch[1].trim() : '39235010';

      const unitMatch = content.match(/<BASEUNITS>([^<]+)<\/BASEUNITS>/i);
      const unit = unitMatch ? unitMatch[1].trim() : 'PCS';

      const existingIdx = currentItems.findIndex((it) => it.name.toLowerCase() === name.toLowerCase());
      if (existingIdx >= 0) {
        currentItems[existingIdx] = {
          ...currentItems[existingIdx],
          hsn: hsn || currentItems[existingIdx].hsn,
          unit: unit || currentItems[existingIdx].unit
        };
      } else {
        currentItems.push({
          id: `ITEM-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          name,
          description: name,
          hsn,
          unit,
          baseRate: 0.30,
          gstRate: 18,
          stockQty: 10000,
          category: 'Plastics'
        });
        newItemsCount++;
      }
    }

    await writeJson(PARTIES_FILE, currentParties);
    await writeJson(ITEMS_FILE, currentItems);

    res.json({
      success: true,
      message: `Tally Masters imported successfully! (${newPartiesCount} new customers, ${newItemsCount} new items)`,
      partiesCount: currentParties.length,
      itemsCount: currentItems.length
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Fetch Live Masters from Tally on local Port 9000
router.post('/masters/fetch-from-tally', async (req, res) => {
  try {
    const settings = await readJson(SETTINGS_FILE, {});
    const host = settings.tally?.host || 'localhost';
    const port = settings.tally?.port || 9000;

    const requestXml = `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>Ledger</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
    </DESC>
  </BODY>
</ENVELOPE>`;

    const response = await fetch(`http://${host}:${port}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/xml; charset=utf-8' },
      body: requestXml,
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      throw new Error(`Tally Prime on ${host}:${port} is offline or not responding.`);
    }

    const xml = await response.text();
    // Use import parser
    const currentParties = await readJson(PARTIES_FILE, []);
    let count = 0;

    const ledgerRegex = /<LEDGER\s+NAME="([^"]+)"[^>]*>([\s\S]*?)<\/LEDGER>/gi;
    let lMatch;
    while ((lMatch = ledgerRegex.exec(xml)) !== null) {
      const name = lMatch[1].replace(/&amp;/g, '&').trim();
      const content = lMatch[2];
      const gstinMatch = content.match(/<PARTYGSTIN>([^<]+)<\/PARTYGSTIN>/i);
      const gstin = gstinMatch ? gstinMatch[1].trim() : '';

      const exists = currentParties.some((p) => p.name.toLowerCase() === name.toLowerCase());
      if (!exists && name !== 'Cash' && name !== 'Profit & Loss A/c') {
        currentParties.push({
          id: `PART-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          name,
          contactPerson: '',
          phone: '',
          email: '',
          address: '',
          city: '',
          state: 'Gujarat',
          stateCode: '24',
          pincode: '',
          gstin,
          pan: gstin ? gstin.slice(2, 12) : '',
          creditDays: 30,
          openingBalance: 0
        });
        count++;
      }
    }

    await writeJson(PARTIES_FILE, currentParties);
    res.json({
      success: true,
      message: `Fetched ${count} ledgers directly from Tally Prime!`,
      totalParties: currentParties.length
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
