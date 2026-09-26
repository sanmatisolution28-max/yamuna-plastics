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

const GST_STATE_MAP = {
  '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
  '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan',
  '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh',
  '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura',
  '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand',
  '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
  '25': 'Daman & Diu', '26': 'Dadra & Nagar Haveli', '27': 'Maharashtra', '28': 'Andhra Pradesh',
  '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala',
  '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman & Nicobar', '36': 'Telangana',
  '37': 'Andhra Pradesh', '38': 'Ladakh'
};

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

// Helper: Parse XML for Sundry Debtors and Stock Items
function parseTallyMastersXml(xml, currentParties = [], currentItems = []) {
  let newPartiesCount = 0;
  let updatedPartiesCount = 0;
  let newItemsCount = 0;
  let updatedItemsCount = 0;

  // 1. Parse Ledgers (Sundry Debtors ONLY)
  const ledgerRegex = /<LEDGER\s+NAME="([^"]+)"[^>]*>([\s\S]*?)<\/LEDGER>/gi;
  let lMatch;
  while ((lMatch = ledgerRegex.exec(xml)) !== null) {
    const rawName = lMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
    const content = lMatch[2];

    // Filter: Ignore non-debtors if parent is explicitly present and not Sundry Debtors
    const parentMatch = content.match(/<PARENT[^>]*>([^<]+)<\/PARENT>/i);
    const parent = parentMatch ? parentMatch[1].trim() : '';
    if (parent && !parent.toLowerCase().includes('debtor') && !parent.toLowerCase().includes('customer')) {
      continue;
    }

    const lowerName = rawName.toLowerCase();
    const isExcluded =
      lowerName === 'cash' ||
      lowerName.includes('profit & loss') ||
      lowerName.includes('cgst') ||
      lowerName.includes('sgst') ||
      lowerName.includes('igst') ||
      lowerName.includes('output') ||
      lowerName.includes('input') ||
      lowerName.includes('round off') ||
      lowerName.includes('freight') ||
      lowerName.includes('delivery charge') ||
      lowerName.includes('sales -') ||
      lowerName.includes('interstate sales') ||
      lowerName.includes('purchase') ||
      lowerName.includes('bank') ||
      lowerName.includes('duties & taxes') ||
      lowerName.includes('discount') ||
      lowerName.includes('expense') ||
      lowerName.includes('ledger');

    if (isExcluded) {
      continue;
    }

    // Extract GSTIN
    const gstinMatch = content.match(/<PARTYGSTIN[^>]*>([0-9A-Z]{15})<\/PARTYGSTIN>/i) ||
                       content.match(/([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})/i);
    const gstin = gstinMatch ? gstinMatch[1].trim().toUpperCase() : '';

    // State & State Code
    let stateCode = gstin && gstin.length >= 2 ? gstin.slice(0, 2) : '24';
    let state = GST_STATE_MAP[stateCode] || 'Gujarat';

    const stateMatch = content.match(/<STATENAME[^>]*>([^<]+)<\/STATENAME>/i) ||
                       content.match(/<LEDSTATENAME[^>]*>([^<]+)<\/LEDSTATENAME>/i);
    if (stateMatch && stateMatch[1].trim() && stateMatch[1].trim() !== 'STATENAME') {
      state = stateMatch[1].trim();
    }

    // Address
    const addressLines = [];
    const addrRegex = /<ADDRESS[^>]*>([^<]+)<\/ADDRESS>/gi;
    let aM;
    while ((aM = addrRegex.exec(content)) !== null) {
      const line = aM[1].replace(/&amp;/g, '&').trim();
      if (line && line !== 'ADDRESS') addressLines.push(line);
    }

    // Phone / Mobile
    const phoneMatch = content.match(/<LEDGERMOBILE[^>]*>([^<]+)<\/LEDGERMOBILE>/i) ||
                       content.match(/<LEDGERPHONE[^>]*>([^<]+)<\/LEDGERPHONE>/i);
    const phone = phoneMatch && phoneMatch[1].trim() !== 'LEDGERPHONE' ? phoneMatch[1].trim() : '';

    // Pincode
    const pinMatch = content.match(/<PINCODE[^>]*>([0-9]{6})<\/PINCODE>/i);
    const pincode = pinMatch ? pinMatch[1].trim() : '';

    // Check if party already exists by name
    const existingIdx = currentParties.findIndex((p) => p.name.toLowerCase() === rawName.toLowerCase());
    if (existingIdx >= 0) {
      currentParties[existingIdx] = {
        ...currentParties[existingIdx],
        gstin: gstin || currentParties[existingIdx].gstin,
        state: state || currentParties[existingIdx].state,
        stateCode: stateCode || currentParties[existingIdx].stateCode,
        address: addressLines.join(', ') || currentParties[existingIdx].address,
        phone: phone || currentParties[existingIdx].phone,
        pincode: pincode || currentParties[existingIdx].pincode,
        source: 'Tally Prime'
      };
      updatedPartiesCount++;
    } else {
      currentParties.push({
        id: `PART-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: rawName,
        contactPerson: '',
        phone,
        email: '',
        address: addressLines.join(', '),
        city: '',
        state,
        stateCode,
        pincode,
        gstin,
        pan: gstin ? gstin.slice(2, 12) : '',
        creditDays: 30,
        openingBalance: 0,
        source: 'Tally Prime'
      });
      newPartiesCount++;
    }
  }

  // 2. Parse Stock Items
  const itemRegex = /<STOCKITEM\s+NAME="([^"]+)"[^>]*>([\s\S]*?)<\/STOCKITEM>/gi;
  let iMatch;
  while ((iMatch = itemRegex.exec(xml)) !== null) {
    const rawName = iMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
    const content = iMatch[2];

    const hsnMatch = content.match(/<HSNCODE[^>]*>([^<]+)<\/HSNCODE>/i) ||
                     content.match(/<HSNDETAILS[^>]*>([^<]+)<\/HSNDETAILS>/i);
    const hsn = hsnMatch && hsnMatch[1].trim() !== 'HSNCODE' ? hsnMatch[1].trim() : '39232100';

    const unitMatch = content.match(/<BASEUNITS[^>]*>([^<]+)<\/BASEUNITS>/i);
    const unit = unitMatch && unitMatch[1].trim() !== 'BASEUNITS' ? unitMatch[1].trim().toUpperCase() : 'KGS';

    // Rate
    let rate = 125.00;
    const rateMatch = content.match(/<CLOSINGRATE[^>]*>([0-9.]+)[^<]*<\/CLOSINGRATE>/i) ||
                      content.match(/<OPENINGRATE[^>]*>([0-9.]+)[^<]*<\/OPENINGRATE>/i);
    if (rateMatch && Number(rateMatch[1]) > 0) {
      rate = Number(rateMatch[1]);
    }

    const existingIdx = currentItems.findIndex((it) => it.name.toLowerCase() === rawName.toLowerCase());
    if (existingIdx >= 0) {
      currentItems[existingIdx] = {
        ...currentItems[existingIdx],
        hsn: hsn || currentItems[existingIdx].hsn,
        unit: unit || currentItems[existingIdx].unit,
        baseRate: rate || currentItems[existingIdx].baseRate,
        source: 'Tally Prime'
      };
      updatedItemsCount++;
    } else {
      currentItems.push({
        id: `ITEM-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: rawName,
        description: rawName,
        hsn,
        unit,
        baseRate: rate,
        gstRate: 18,
        stockQty: 1000,
        category: 'Plastic Products',
        source: 'Tally Prime'
      });
      newItemsCount++;
    }
  }

  return {
    parties: currentParties,
    items: currentItems,
    newPartiesCount,
    updatedPartiesCount,
    newItemsCount,
    updatedItemsCount
  };
}

// ---------------------------------------------------------
// ROUTES
// ---------------------------------------------------------

// Parties / Customers
router.get('/parties', async (req, res) => {
  try {
    const parties = await readJson(PARTIES_FILE, []);
    res.json(parties);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/parties/clear', async (req, res) => {
  try {
    await writeJson(PARTIES_FILE, []);
    res.json({ success: true, message: 'Parties reset to 0' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/items/clear', async (req, res) => {
  try {
    await writeJson(ITEMS_FILE, []);
    res.json({ success: true, message: 'Items reset to 0' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/parties', async (req, res) => {
  try {
    const parties = await readJson(PARTIES_FILE, []);
    const gstin = (req.body.gstin || '').trim().toUpperCase();
    const stateCode = req.body.stateCode || (gstin ? gstin.slice(0, 2) : '24');
    const state = req.body.state || GST_STATE_MAP[stateCode] || 'Gujarat';

    const newParty = {
      id: `PART-${Date.now()}`,
      name: req.body.name || 'New Customer',
      contactPerson: req.body.contactPerson || '',
      phone: req.body.phone || '',
      email: req.body.email || '',
      address: req.body.address || '',
      city: req.body.city || '',
      state,
      stateCode,
      pincode: req.body.pincode || '',
      gstin,
      pan: req.body.pan || (gstin ? gstin.slice(2, 12) : ''),
      creditDays: Number(req.body.creditDays || 30),
      openingBalance: Number(req.body.openingBalance || 0),
      source: 'User Created'
    };
    parties.push(newParty);
    await writeJson(PARTIES_FILE, parties);
    res.status(201).json(newParty);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Items / Products
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
      description: req.body.description || req.body.name || '',
      hsn: req.body.hsn || '39232100',
      unit: (req.body.unit || 'KGS').toUpperCase(),
      baseRate: Number(req.body.baseRate || 100),
      gstRate: Number(req.body.gstRate || 18),
      stockQty: Number(req.body.stockQty || 0),
      category: req.body.category || 'General',
      source: 'User Created'
    };
    items.push(newItem);
    await writeJson(ITEMS_FILE, items);
    res.status(201).json(newItem);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Settings
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

// 1. Fetch Live Masters Directly From Tally (Port 9000)
// ONLY pulls Sundry Debtors (Customers) and Stock Items
router.post('/masters/fetch-from-tally', async (req, res) => {
  try {
    const settings = await readJson(SETTINGS_FILE, {});
    const host = settings.tally?.host || 'localhost';
    const port = settings.tally?.port || 9000;

    // Fetch Only Sundry Debtors
    const debtorRequestXml = `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>DebtorCollection</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="DebtorCollection">
            <TYPE>Ledger</TYPE>
            <CHILDOF>$$GroupSundryDebtors</CHILDOF>
            <BELONGSTO>Yes</BELONGSTO>
            <FETCH>NAME, PARENT, PARTYGSTIN, STATENAME, LEDSTATENAME, ADDRESS.LIST, ADDRESS, PINCODE, LEDGERPHONE, LEDGERMOBILE</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;

    // Fetch Only Stock Items
    const stockRequestXml = `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>StockCollection</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="StockCollection">
            <TYPE>StockItem</TYPE>
            <FETCH>NAME, BASEUNITS, OPENINGRATE, CLOSINGRATE, HSNCODE, HSNDETAILS, GSTRATEDETAILS</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;

    const currentParties = await readJson(PARTIES_FILE, []);
    const currentItems = await readJson(ITEMS_FILE, []);

    let debtorXml = '';
    let stockXml = '';

    // Request Debtors
    try {
      const dRes = await fetch(`http://${host}:${port}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/xml; charset=utf-8' },
        body: debtorRequestXml,
        signal: AbortSignal.timeout(6000)
      });
      if (dRes.ok) {
        debtorXml = await dRes.text();
      }
    } catch (dErr) {
      console.warn('Debtor fetch warning:', dErr.message);
    }

    // Request Stock Items
    try {
      const sRes = await fetch(`http://${host}:${port}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/xml; charset=utf-8' },
        body: stockRequestXml,
        signal: AbortSignal.timeout(6000)
      });
      if (sRes.ok) {
        stockXml = await sRes.text();
      }
    } catch (sErr) {
      console.warn('Stock fetch warning:', sErr.message);
    }

    if (!debtorXml && !stockXml) {
      throw new Error(`Tally Prime is offline on http://${host}:${port}. Please verify Tally is open.`);
    }

    const combinedXml = debtorXml + '\n' + stockXml;
    const result = parseTallyMastersXml(combinedXml, currentParties, currentItems);

    await writeJson(PARTIES_FILE, result.parties);
    await writeJson(ITEMS_FILE, result.items);

    res.json({
      success: true,
      message: `Fetched ${result.newPartiesCount + result.updatedPartiesCount} customers and ${result.newItemsCount + result.updatedItemsCount} stock items from Tally Prime!`,
      totalParties: result.parties.length,
      totalItems: result.items.length,
      parties: result.parties,
      items: result.items
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Inbound Endpoint for Tally TDL Outbound Push
// When accountant presses "Push Masters" in Tally, Tally POSTs to this endpoint!
router.post('/masters/tally-push', async (req, res) => {
  try {
    let xml = '';
    if (typeof req.body === 'string') {
      xml = req.body;
    } else if (Buffer.isBuffer(req.body)) {
      xml = req.body.toString('utf8');
    } else if (req.body && typeof req.body.xml === 'string') {
      xml = req.body.xml;
    } else if (req.body && typeof req.body === 'object') {
      xml = JSON.stringify(req.body);
    }

    const currentParties = await readJson(PARTIES_FILE, []);
    const currentItems = await readJson(ITEMS_FILE, []);

    const result = parseTallyMastersXml(xml, currentParties, currentItems);

    await writeJson(PARTIES_FILE, result.parties);
    await writeJson(ITEMS_FILE, result.items);

    res.json({
      success: true,
      message: `Tally Masters synchronized! (${result.newPartiesCount + result.updatedPartiesCount} debtors, ${result.newItemsCount + result.updatedItemsCount} items)`,
      partiesCount: result.parties.length,
      itemsCount: result.items.length
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Import Tally Masters XML manually
router.post('/masters/import-tally-xml', async (req, res) => {
  try {
    const xml = typeof req.body === 'string' ? req.body : (req.body.xml || '');
    if (!xml || !xml.trim()) {
      return res.status(400).json({ success: false, error: 'No XML content provided' });
    }

    const currentParties = await readJson(PARTIES_FILE, []);
    const currentItems = await readJson(ITEMS_FILE, []);

    const result = parseTallyMastersXml(xml, currentParties, currentItems);

    await writeJson(PARTIES_FILE, result.parties);
    await writeJson(ITEMS_FILE, result.items);

    res.json({
      success: true,
      message: `Tally XML parsed successfully! (${result.newPartiesCount} new debtors, ${result.newItemsCount} new items)`,
      totalParties: result.parties.length,
      totalItems: result.items.length,
      parties: result.parties,
      items: result.items
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
