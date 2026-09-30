import express from 'express';
import {
  getParties,
  saveParties,
  getItems,
  saveItems,
  getSettings,
  saveSettings,
  raiseSeqTo,
  getSeqState,
  recordTallyReading
} from '../lib/db.js';
import {
  fetchDebtorsXml,
  fetchStockItemsXml,
  fetchMaxVoucherNumber,
  tallyOptionsFromSettings
} from '../lib/tallyClient.js';

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

    // HSN Code
    const hsnMatch = content.match(/<HSNCODE[^>]*>([^<]+)<\/HSNCODE>/i) ||
                     content.match(/<HSNDETAILS[^>]*>([^<]+)<\/HSNDETAILS>/i) ||
                     content.match(/<GSTHSNCODE[^>]*>([^<]+)<\/GSTHSNCODE>/i);
    const hsn = hsnMatch && hsnMatch[1].trim() && hsnMatch[1].trim() !== 'HSNCODE' ? hsnMatch[1].trim() : '39232100';

    // Unit of measurement
    const unitMatch = content.match(/<BASEUNITS[^>]*>([^<]+)<\/BASEUNITS>/i) ||
                      content.match(/<UOM[^>]*>([^<]+)<\/UOM>/i);
    const unit = unitMatch && unitMatch[1].trim() && unitMatch[1].trim() !== 'BASEUNITS' ? unitMatch[1].trim().toUpperCase() : 'KGS';

    // Group / Category
    const parentMatch = content.match(/<PARENT[^>]*>([^<]+)<\/PARENT>/i) ||
                        content.match(/<CATEGORY[^>]*>([^<]+)<\/CATEGORY>/i);
    const category = parentMatch && parentMatch[1].trim() && parentMatch[1].trim() !== 'PARENT' ? parentMatch[1].trim() : 'Plastic Products';

    // Description / Mailing name
    const descMatch = content.match(/<DESCRIPTION[^>]*>([^<]+)<\/DESCRIPTION>/i) ||
                      content.match(/<MAILINGNAME[^>]*>([^<]+)<\/MAILINGNAME>/i);
    const description = descMatch && descMatch[1].trim() ? descMatch[1].trim() : rawName;

    // Part Number
    const partNoMatch = content.match(/<PARTNO[^>]*>([^<]+)<\/PARTNO>/i);
    const partNo = partNoMatch ? partNoMatch[1].trim() : '';

    // GST Rate (%)
    let gstRate = 18;
    const gstMatch = content.match(/<GSTRATE[^>]*>([0-9.]+)/i) ||
                     content.match(/<IGSTRATE[^>]*>([0-9.]+)/i) ||
                     content.match(/<INTEGRATEDTAX[^>]*>([0-9.]+)/i) ||
                     content.match(/<GSTRATEDETAILS\.LIST>[\s\S]*?<GSTRATE[^>]*>([0-9.]+)/i);
    if (gstMatch && Number(gstMatch[1]) > 0) {
      gstRate = Number(gstMatch[1]);
    }

    // Stock Quantity
    let stockQty = 0;
    const qtyMatch = content.match(/<CLOSINGBALANCE[^>]*>([0-9.-]+)/i) ||
                     content.match(/<OPENINGBALANCE[^>]*>([0-9.-]+)/i);
    if (qtyMatch && !isNaN(parseFloat(qtyMatch[1]))) {
      stockQty = Math.abs(parseFloat(qtyMatch[1]));
    }

    // Rate - Extract exact item rate from Tally
    let rate = 0;
    const rateMatch = content.match(/<RATE(?:\s*|\s+[^>]*)>([0-9.]+)/i) ||
                      content.match(/<CLOSINGRATE(?:\s*|\s+[^>]*)>([0-9.]+)/i) ||
                      content.match(/<OPENINGRATE(?:\s*|\s+[^>]*)>([0-9.]+)/i) ||
                      content.match(/<STANDARDPRICELIST\.LIST>[\s\S]*?<RATE(?:\s*|\s+[^>]*)>([0-9.]+)/i) ||
                      content.match(/<STANDARDCOSTLIST\.LIST>[\s\S]*?<RATE(?:\s*|\s+[^>]*)>([0-9.]+)/i) ||
                      content.match(/<STANDARDPRICE(?:\s*|\s+[^>]*)>([0-9.]+)/i) ||
                      content.match(/<STANDARDCOST(?:\s*|\s+[^>]*)>([0-9.]+)/i) ||
                      content.match(/<LASTSALERATE(?:\s*|\s+[^>]*)>([0-9.]+)/i);
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
        gstRate: gstRate || currentItems[existingIdx].gstRate || 18,
        category: category || currentItems[existingIdx].category,
        description: description || currentItems[existingIdx].description,
        partNo: partNo || currentItems[existingIdx].partNo,
        stockQty: stockQty !== undefined && stockQty !== 0 ? stockQty : currentItems[existingIdx].stockQty,
        source: 'Tally Prime'
      };
      updatedItemsCount++;
    } else {
      currentItems.push({
        id: `ITEM-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: rawName,
        description,
        partNo,
        hsn,
        unit,
        baseRate: rate,
        gstRate,
        stockQty,
        category,
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
    const parties = await getParties();
    res.json(parties);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/parties/clear', async (req, res) => {
  // Protect data: Do not wipe customer parties
  res.json({ success: true, message: 'Customers are persistent and protected from deletion.' });
});

router.post('/items/clear', async (req, res) => {
  // Protect data: Do not wipe products catalog
  res.json({ success: true, message: 'Products are persistent and protected from deletion.' });
});

router.post('/parties', async (req, res) => {
  try {
    const parties = await getParties();
    const name = (req.body.name || '').trim();
    if (!name) {
      return res.status(400).json({ error: 'Customer / Party name is required' });
    }

    const gstin = (req.body.gstin || '').trim().toUpperCase();
    const stateCode = req.body.stateCode || (gstin ? gstin.slice(0, 2) : '24');
    const state = req.body.state || GST_STATE_MAP[stateCode] || 'Gujarat';

    const existingIdx = parties.findIndex((p) => p && p.name && p.name.toLowerCase() === name.toLowerCase());
    if (existingIdx >= 0) {
      // Update existing customer in-place without removing other customers
      parties[existingIdx] = {
        ...parties[existingIdx],
        ...req.body,
        name,
        state,
        stateCode,
        gstin,
        pan: req.body.pan || (gstin ? gstin.slice(2, 12) : parties[existingIdx].pan)
      };
      await saveParties(parties);
      return res.status(200).json(parties[existingIdx]);
    }

    const newParty = {
      id: `PART-${Date.now()}`,
      name,
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
    await saveParties(parties);
    res.status(201).json(newParty);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Items / Products
/**
 * One endpoint the client can trust for "what is the next bill number".
 * The counter is read from invoice_seq, so this can never disagree with the
 * number a real save will be given.
 */
router.get('/next-invoice-number', async (req, res) => {
  try {
    const settings = await getSettings();
    const prefix = settings.invoicePrefix || 'YP/26-27/';
    const { nextValue } = await getSeqState();
    res.json({
      prefix,
      nextSeq: nextValue,
      invoiceNo: `${prefix}${nextValue}`,
      latestIdentified: Math.max(0, nextValue - 1)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/items', async (req, res) => {
  try {
    const items = await getItems();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/items', async (req, res) => {
  try {
    const items = await getItems();
    const name = (req.body.name || '').trim();
    if (!name) {
      return res.status(400).json({ error: 'Product name is required' });
    }

    const existingIdx = items.findIndex((it) => it && it.name && it.name.toLowerCase() === name.toLowerCase());
    if (existingIdx >= 0) {
      // Update existing item in-place without removing other products
      items[existingIdx] = {
        ...items[existingIdx],
        ...req.body,
        name,
        unit: (req.body.unit || items[existingIdx].unit || 'KGS').toUpperCase(),
        baseRate: Number(req.body.baseRate !== undefined ? req.body.baseRate : items[existingIdx].baseRate || 0),
        gstRate: Number(req.body.gstRate !== undefined ? req.body.gstRate : items[existingIdx].gstRate || 18),
        stockQty: Number(req.body.stockQty !== undefined ? req.body.stockQty : items[existingIdx].stockQty || 0),
        category: req.body.category || items[existingIdx].category || 'General'
      };
      await saveItems(items);
      return res.status(200).json(items[existingIdx]);
    }

    const newItem = {
      id: `ITEM-${Date.now()}`,
      name,
      description: req.body.description || name,
      hsn: req.body.hsn || '39232100',
      unit: (req.body.unit || 'KGS').toUpperCase(),
      baseRate: Number(req.body.baseRate || 0),
      gstRate: Number(req.body.gstRate || 18),
      stockQty: Number(req.body.stockQty || 0),
      category: req.body.category || 'General',
      source: 'User Created'
    };
    items.push(newItem);
    await saveItems(items);
    res.status(201).json(newItem);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Settings
// Never ship credentials to the browser. Bank details and e-Way Bill secrets
// are stripped out; the full record stays server-side.
function redactSettings(settings) {
  const { ewayBill, ...rest } = settings || {};
  const safeEway = ewayBill
    ? Object.fromEntries(
        Object.entries(ewayBill).map(([k, v]) => [
          k,
          /password|secret|token|key/i.test(k) ? (v ? '********' : '') : v
        ])
      )
    : undefined;
  return { ...rest, ewayBill: safeEway };
}

router.get('/settings', async (req, res) => {
  try {
    res.json(redactSettings(await getSettings()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/settings', async (req, res) => {
  try {
    const current = await getSettings();
    const updated = {
      ...current,
      ...req.body,
      company: { ...(current.company || {}), ...(req.body.company || {}) },
      tally: { ...(current.tally || {}), ...(req.body.tally || {}) },
      ewayBill: { ...(current.ewayBill || {}), ...(req.body.ewayBill || {}) }
    };

    // A client that still posts nextInvoiceNumber means "set the counter", so
    // route it to the real invoice_seq counter instead of persisting a second
    // copy in settings that would immediately drift again.
    if (req.body?.nextInvoiceNumber !== undefined) {
      const n = Number(req.body.nextInvoiceNumber);
      if (Number.isInteger(n) && n > 0) {
        await raiseSeqTo(n, 'settings');
      }
    }

    const saved = await saveSettings(updated);
    res.json(redactSettings(saved));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Shared: merge Tally master XML and align the bill-number counter
// ---------------------------------------------------------------------------

/** Apply parsed masters, but never let a bad parse wipe existing data. */
async function applyMasters(result, currentParties, currentItems) {
  const finalParties = result.parties?.length ? result.parties : currentParties;
  const finalItems = result.items?.length ? result.items : currentItems;
  await saveParties(finalParties);
  await saveItems(finalItems);
  return { finalParties, finalItems };
}

/**
 * Align numbering with a voucher number reported by Tally.
 * raiseSeqTo only ever moves the counter forward, so a stale or wrong reading
 * can never rewind numbering into territory Tally has already used.
 */
async function alignSequenceToTally(voucherNumbers) {
  let maxTallyNum = 0;
  for (const v of voucherNumbers || []) {
    const m = String(v).match(/(\d+)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!Number.isNaN(n) && n > maxTallyNum) maxTallyNum = n;
    }
  }
  if (maxTallyNum <= 0) return { latestTallyVoucher: 0, nextInvoiceNumber: null };

  const state = await raiseSeqTo(maxTallyNum + 1, 'tally-master-push');
  return { latestTallyVoucher: maxTallyNum, nextInvoiceNumber: state.nextValue };
}

// ---------------------------------------------------------------------------
// 1. Fetch masters straight from a reachable Tally (local PC / same network)
// ---------------------------------------------------------------------------

router.post('/masters/fetch-from-tally', async (req, res) => {
  const tallyOpts = tallyOptionsFromSettings(await getSettings());
  const currentParties = await getParties();
  const currentItems = await getItems();

  const [debtors, stock, vouchers] = await Promise.allSettled([
    fetchDebtorsXml(tallyOpts),
    fetchStockItemsXml(tallyOpts),
    fetchMaxVoucherNumber(tallyOpts)
  ]);

  const failures = [debtors, stock, vouchers].filter((r) => r.status === 'rejected');
  if (failures.length === 3) {
    return res.status(503).json({
      success: false,
      error: `Tally Prime is not reachable on http://${tallyOpts.host}:${tallyOpts.port}. Open Tally and enable the HTTP server (F1 > Settings > Connectivity > Enable).`,
      detail: failures[0].reason?.message
    });
  }

  const debtorXml = debtors.status === 'fulfilled' ? debtors.value : '';
  const stockXml = stock.status === 'fulfilled' ? stock.value : '';
  const voucherNumbers = vouchers.status === 'fulfilled' ? vouchers.value.numbers : [];

  const result = parseTallyMastersXml(`${debtorXml}\n${stockXml}`, currentParties, currentItems);
  const { finalParties, finalItems } = await applyMasters(result, currentParties, currentItems);
  const seq = await alignSequenceToTally(voucherNumbers);

  res.json({
    success: true,
    message: `Fetched ${result.newPartiesCount + result.updatedPartiesCount} customers and ${result.newItemsCount + result.updatedItemsCount} stock items from Tally Prime.`,
    totalParties: finalParties.length,
    totalItems: finalItems.length,
    parties: finalParties,
    items: finalItems,
    latestTallyVoucher: seq.latestTallyVoucher || undefined,
    nextInvoiceNumber: seq.nextInvoiceNumber || undefined,
    warnings: failures.map((f) => f.reason?.message).filter(Boolean)
  });
});

// ---------------------------------------------------------------------------
// 2. Inbound push from the local bridge agent / Tally masters export
//    This is the path that works from the cloud, because the agent runs on the
//    PC that has Tally open and uploads from there.
// ---------------------------------------------------------------------------

function extractXmlFromBody(body) {
  if (typeof body === 'string') return body;
  if (Buffer.isBuffer(body)) return body.toString('utf8');
  if (body && typeof body.xml === 'string') return body.xml;
  if (body && typeof body === 'object') return JSON.stringify(body);
  return '';
}

router.post('/masters/tally-push', async (req, res) => {
  try {
    const xml = extractXmlFromBody(req.body);
    if (!xml.trim()) {
      return res.status(400).json({ success: false, error: 'No XML content provided' });
    }

    const currentParties = await getParties();
    const currentItems = await getItems();

    const result = parseTallyMastersXml(xml, currentParties, currentItems);
    const { finalParties, finalItems } = await applyMasters(result, currentParties, currentItems);

    let seq = { latestTallyVoucher: 0, nextInvoiceNumber: null };
    if (xml.includes('<VOUCHERNUMBER')) {
      const numbers = [...xml.matchAll(/<VOUCHERNUMBER[^>]*>([^<]+)<\/VOUCHERNUMBER>/gi)].map((m) => m[1].trim());
      seq = await alignSequenceToTally(numbers);
    }

    res.json({
      success: true,
      message: `Tally Masters synchronized (${result.newPartiesCount + result.updatedPartiesCount} debtors, ${result.newItemsCount + result.updatedItemsCount} items).`,
      partiesCount: finalParties.length,
      itemsCount: finalItems.length,
      latestTallyVoucher: seq.latestTallyVoucher || undefined,
      nextInvoiceNumber: seq.nextInvoiceNumber || undefined
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 2b. Numbering heartbeat.
 * The local agent reports Tally's highest voucher number so the portal can keep
 * the next bill number ahead of Tally even though the cloud cannot see Tally
 * directly. This is what makes "last bill in Tally was 250" show up live.
 */
router.post('/masters/tally-reading', async (req, res) => {
  try {
    const { maxVoucher, voucherCount, company } = req.body || {};
    const max = Number(maxVoucher || 0);
    if (!Number.isFinite(max) || max < 0) {
      return res.status(400).json({ success: false, error: 'maxVoucher must be a non-negative number' });
    }
    await recordTallyReading(max, company || '');
    const seq = max > 0 ? await raiseSeqTo(max + 1, 'tally-reading') : await getSeqState();
    res.json({
      success: true,
      latestTallyVoucher: max,
      voucherCount: Number(voucherCount || 0),
      nextInvoiceNumber: seq.nextValue
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// 3. Manual XML import (paste / file upload)
// ---------------------------------------------------------------------------

router.post('/masters/import-tally-xml', async (req, res) => {
  try {
    const xml = typeof req.body === 'string' ? req.body : req.body?.xml || '';
    if (!xml || !xml.trim()) {
      return res.status(400).json({ success: false, error: 'No XML content provided' });
    }

    const currentParties = await getParties();
    const currentItems = await getItems();

    const result = parseTallyMastersXml(xml, currentParties, currentItems);
    const { finalParties, finalItems } = await applyMasters(result, currentParties, currentItems);

    res.json({
      success: true,
      message: `Tally XML parsed (${result.newPartiesCount} new debtors, ${result.newItemsCount} new items).`,
      totalParties: finalParties.length,
      totalItems: finalItems.length,
      parties: finalParties,
      items: finalItems
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
