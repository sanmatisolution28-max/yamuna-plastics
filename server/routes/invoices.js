import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');
const INVOICES_FILE = path.join(DATA_DIR, 'invoices.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

const router = express.Router();

export async function readInvoices() {
  try {
    const raw = await fs.readFile(INVOICES_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function writeInvoices(data) {
  await fs.writeFile(INVOICES_FILE, JSON.stringify(data, null, 2), 'utf8');
}

async function readSettings() {
  try {
    const raw = await fs.readFile(SETTINGS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { nextInvoiceNumber: 105, invoicePrefix: 'YP/26-27/' };
  }
}

async function updateNextInvoiceNumber(nextNum) {
  try {
    const settings = await readSettings();
    settings.nextInvoiceNumber = nextNum;
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to update next invoice number', err);
  }
}

export function extractInvoiceNumber(invoiceNo) {
  if (!invoiceNo) return null;
  const match = String(invoiceNo).match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
}

export function getNextInvoiceSequence(list = [], settings = {}) {
  let maxExisting = 0;
  for (const inv of list) {
    const num = extractInvoiceNumber(inv.invoiceNo);
    if (num !== null && !isNaN(num) && num > maxExisting) {
      maxExisting = num;
    }
  }

  const configured = Number(settings?.nextInvoiceNumber);
  const base = !isNaN(configured) && configured > 0 ? configured : 1;
  return Math.max(base, maxExisting + 1);
}

// Convert number to Indian currency words
function numberToIndianWords(num) {
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  num = Math.round(Number(num));
  if (num === 0) return 'Zero Rupees Only';

  function convertTwoDigits(n) {
    if (n < 20) return a[n];
    return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
  }

  function convertThreeDigits(n) {
    const hundred = Math.floor(n / 100);
    const rest = n % 100;
    let res = '';
    if (hundred > 0) res += a[hundred] + ' Hundred';
    if (rest > 0) res += (res ? ' ' : '') + convertTwoDigits(rest);
    return res;
  }

  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  const lakh = Math.floor(num / 100000);
  num %= 100000;
  const thousand = Math.floor(num / 1000);
  num %= 1000;
  const remainder = num;

  let str = '';
  if (crore > 0) str += convertThreeDigits(crore) + ' Crore ';
  if (lakh > 0) str += convertThreeDigits(lakh) + ' Lakh ';
  if (thousand > 0) str += convertThreeDigits(thousand) + ' Thousand ';
  if (remainder > 0) str += convertThreeDigits(remainder) + ' ';

  return str.trim() + ' Rupees Only';
}

// GET all invoices
router.get('/', async (req, res) => {
  try {
    const { synced, search } = req.query;
    let list = await readInvoices();

    if (synced !== undefined) {
      const isSynced = synced === 'true';
      list = list.filter((i) => Boolean(i.tallySync?.synced) === isSynced);
    }

    if (search) {
      const q = String(search).toLowerCase();
      list = list.filter(
        (i) =>
          i.invoiceNo.toLowerCase().includes(q) ||
          i.partyName.toLowerCase().includes(q) ||
          (i.gstin && i.gstin.toLowerCase().includes(q))
      );
    }

    // Sort newest first
    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET next available invoice sequence (MUST BE BEFORE /:id to prevent parameter capture)
router.get('/next-number', async (req, res) => {
  try {
    const settings = await readSettings();
    const list = await readInvoices();

    // Check if local Tally is active to auto-identify any newly created vouchers in Tally
    const host = settings.tally?.host || 'localhost';
    const port = settings.tally?.port || 9000;
    try {
      const tallyProbeXml = `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>SalesVoucherCollection</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="SalesVoucherCollection">
            <TYPE>Voucher</TYPE>
            <FETCH>VOUCHERNUMBER</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
      const tRes = await fetch(`http://${host}:${port}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/xml; charset=utf-8' },
        body: tallyProbeXml,
        signal: AbortSignal.timeout(600)
      });
      if (tRes.ok) {
        const tXml = await tRes.text();
        const vchMatches = tXml.matchAll(/<VOUCHERNUMBER[^>]*>([^<]+)<\/VOUCHERNUMBER>/gi);
        let maxTally = 0;
        for (const m of vchMatches) {
          const num = extractInvoiceNumber(m[1]);
          if (num !== null && !isNaN(num) && num > maxTally) maxTally = num;
        }
        if (maxTally > 0 && (Number(settings.nextInvoiceNumber) || 1) <= maxTally) {
          settings.nextInvoiceNumber = maxTally + 1;
          await updateNextInvoiceNumber(settings.nextInvoiceNumber);
        }
      }
    } catch {
      // Quietly ignore if Tally offline or Render cloud
    }

    const nextSeq = getNextInvoiceSequence(list, settings);
    const prefix = settings.invoicePrefix || 'YP/26-27/';
    const latestIdentified = Math.max(0, nextSeq - 1);

    res.json({
      nextSeq,
      prefix,
      invoiceNo: `${prefix}${nextSeq}`,
      latestIdentified,
      autoIdentified: true
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single invoice
router.get('/:id', async (req, res) => {
  try {
    const list = await readInvoices();
    const inv = list.find((i) => i.id === req.params.id || i.invoiceNo === req.params.id);
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });
    res.json(inv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST new invoice
router.post('/', async (req, res) => {
  try {
    const body = req.body;
    const settings = await readSettings();
    const list = await readInvoices();

    // Auto-generate invoice number if not provided, strictly sequential
    const nextSeq = getNextInvoiceSequence(list, settings);
    const invoiceNo = body.invoiceNo || `${settings.invoicePrefix || 'YP/26-27/'}${nextSeq}`;

    // Compute what the next sequence must be after saving this invoice
    const customNum = extractInvoiceNumber(invoiceNo);
    const advanceTo = customNum !== null && !isNaN(customNum)
      ? Math.max(nextSeq + 1, customNum + 1)
      : nextSeq + 1;

    // Place of Supply & Interstate calculation
    // Gujarat state code is "24"
    const partyStateCode = String(body.stateCode || (body.gstin ? body.gstin.slice(0, 2) : '24'));
    const isInterstate = partyStateCode !== '24';

    // Calculate line item totals and taxes
    let subTotal = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;

    const items = (body.items || []).map((it, idx) => {
      const qty = Number(it.qty || 1);
      const rate = Number(it.rate || 0);
      const discountPct = Number(it.discountPct || 0);
      const gross = qty * rate;
      const discount = (gross * discountPct) / 100;
      const taxableAmount = gross - discount;
      const gstRate = Number(it.gstRate || 18);

      let cgstAmount = 0;
      let sgstAmount = 0;
      let igstAmount = 0;

      if (!isInterstate) {
        cgstAmount = (taxableAmount * (gstRate / 2)) / 100;
        sgstAmount = (taxableAmount * (gstRate / 2)) / 100;
      } else {
        igstAmount = (taxableAmount * gstRate) / 100;
      }

      subTotal += taxableAmount;
      totalCgst += cgstAmount;
      totalSgst += sgstAmount;
      totalIgst += igstAmount;

      return {
        id: it.id || `item-line-${idx + 1}`,
        itemId: it.itemId || '',
        name: it.name || 'Plastic Product',
        hsn: it.hsn || '39232100',
        qty,
        unit: it.unit || 'KGS',
        rate,
        discountPct,
        taxableAmount: Number(taxableAmount.toFixed(2)),
        gstRate,
        cgstAmount: Number(cgstAmount.toFixed(2)),
        sgstAmount: Number(sgstAmount.toFixed(2)),
        igstAmount: Number(igstAmount.toFixed(2)),
        total: Number((taxableAmount + cgstAmount + sgstAmount + igstAmount).toFixed(2))
      };
    });

    const freightCharges = Number(body.freightCharges || 0);
    const rawTotal = subTotal + totalCgst + totalSgst + totalIgst + freightCharges;
    const grandTotal = Math.round(rawTotal);
    const roundOff = Number((grandTotal - rawTotal).toFixed(2));

    const newInvoice = {
      id: `INV-${Date.now()}`,
      invoiceNo,
      date: body.date || new Date().toISOString().slice(0, 10),
      dueDate: body.dueDate || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      partyId: body.partyId || '',
      partyName: body.partyName || 'Cash Customer',
      gstin: body.gstin || '',
      state: body.state || (isInterstate ? 'Interstate' : 'Gujarat'),
      stateCode: partyStateCode,
      address: body.address || '',
      phone: body.phone || '',
      placeOfSupply: body.placeOfSupply || (isInterstate ? body.state : 'Gujarat'),
      shipTo: body.shipTo ? {
        name: body.shipTo.name || body.partyName || 'Cash Customer',
        gstin: body.shipTo.gstin !== undefined ? body.shipTo.gstin : (body.gstin || ''),
        state: body.shipTo.state || body.state || 'Gujarat',
        stateCode: body.shipTo.stateCode || partyStateCode || '24',
        address: body.shipTo.address !== undefined ? body.shipTo.address : (body.address || ''),
        phone: body.shipTo.phone !== undefined ? body.shipTo.phone : (body.phone || '')
      } : {
        name: body.partyName || 'Cash Customer',
        gstin: body.gstin || '',
        state: body.state || 'Gujarat',
        stateCode: partyStateCode || '24',
        address: body.address || '',
        phone: body.phone || ''
      },
      isInterstate,
      paymentMode: body.paymentMode || 'Credit 30 Days',
      vehicleNo: body.vehicleNo || '',
      transporter: body.transporter || '',
      destination: body.destination || '',
      deliveryNote: body.deliveryNote || '',
      deliveryNoteDate: body.deliveryNoteDate || '',
      distance: Number(body.distance || 85),
      transporterId: body.transporterId || '',
      ewayBillNo: body.ewayBillNo || '',
      ewayBill: (body.ewayBillNo || body.vehicleNo || grandTotal >= 50000) ? {
        status: body.ewayBillNo ? 'Active (Manual/Portal)' : 'Applicable (Ready for Tally)',
        ewayBillNo: body.ewayBillNo || `24${String(invoiceNo).replace(/\D/g, '').slice(-3).padStart(3, '0')}82500${Math.floor(100 + Math.random() * 900)}`,
        ewayBillDate: body.date || new Date().toISOString().slice(0, 10),
        validUntil: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
        transporter: body.transporter || 'Patel Freight',
        transporterId: body.transporterId || '',
        vehicleNo: body.vehicleNo || '',
        distance: Number(body.distance || 85),
        syncedAt: new Date().toISOString()
      } : null,
      items,
      subTotal: Number(subTotal.toFixed(2)),
      totalCgst: Number(totalCgst.toFixed(2)),
      totalSgst: Number(totalSgst.toFixed(2)),
      totalIgst: Number(totalIgst.toFixed(2)),
      totalGst: Number((totalCgst + totalSgst + totalIgst).toFixed(2)),
      freightCharges,
      roundOff,
      grandTotal,
      amountInWords: numberToIndianWords(grandTotal),
      notes: body.notes || '',
      status: 'Final',
      tallySync: {
        synced: false,
        syncTime: null,
        tallyVoucherNo: null,
        method: null
      },
      createdAt: new Date().toISOString()
    };

    list.unshift(newInvoice);
    await writeInvoices(list);
    await updateNextInvoiceNumber(advanceTo);

    res.status(201).json(newInvoice);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update existing invoice
router.put('/:id', async (req, res) => {
  try {
    const list = await readInvoices();
    const idx = list.findIndex((i) => i.id === req.params.id || i.invoiceNo === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Invoice not found' });

    const existing = list[idx];
    const body = req.body;

    const companyGstin = '24AKNPP7596H1ZF';
    const companyStateCode = '24';
    const partyStateCode = (body.gstin && body.gstin.length >= 2)
      ? body.gstin.slice(0, 2)
      : (body.stateCode || '24');
    const isInterstate = partyStateCode !== companyStateCode;

    let subTotal = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;

    const items = (body.items || existing.items || []).map((item, index) => {
      const qty = Number(item.qty || 1);
      const rate = Number(item.rate || 0);
      const discountPct = Number(item.discountPct || 0);
      const lineBeforeDiscount = qty * rate;
      const discountAmount = (lineBeforeDiscount * discountPct) / 100;
      const taxableAmount = lineBeforeDiscount - discountAmount;
      const gstRate = Number(item.gstRate || 18);

      let cgstAmount = 0;
      let sgstAmount = 0;
      let igstAmount = 0;

      if (!isInterstate) {
        cgstAmount = (taxableAmount * (gstRate / 2)) / 100;
        sgstAmount = (taxableAmount * (gstRate / 2)) / 100;
      } else {
        igstAmount = (taxableAmount * gstRate) / 100;
      }

      subTotal += taxableAmount;
      totalCgst += cgstAmount;
      totalSgst += sgstAmount;
      totalIgst += igstAmount;

      return {
        itemId: item.itemId || `ITEM-${index + 1}`,
        name: item.name,
        hsn: item.hsn || '',
        qty,
        unit: item.unit || 'PCS',
        rate,
        discountPct,
        taxableAmount: Number(taxableAmount.toFixed(2)),
        gstRate,
        cgstAmount: Number(cgstAmount.toFixed(2)),
        sgstAmount: Number(sgstAmount.toFixed(2)),
        igstAmount: Number(igstAmount.toFixed(2)),
        total: Number((taxableAmount + cgstAmount + sgstAmount + igstAmount).toFixed(2))
      };
    });

    const freightCharges = Number(body.freightCharges !== undefined ? body.freightCharges : existing.freightCharges || 0);
    const rawTotal = subTotal + totalCgst + totalSgst + totalIgst + freightCharges;
    const grandTotal = Math.round(rawTotal);
    const roundOff = Number((grandTotal - rawTotal).toFixed(2));

    const wasSynced = existing.tallySync?.synced;

    const updatedInvoice = {
      ...existing,
      invoiceNo: body.invoiceNo || existing.invoiceNo,
      date: body.date || existing.date,
      dueDate: body.dueDate || existing.dueDate,
      partyId: body.partyId !== undefined ? body.partyId : existing.partyId,
      partyName: body.partyName || existing.partyName,
      gstin: body.gstin !== undefined ? body.gstin : existing.gstin,
      state: body.state || existing.state,
      stateCode: partyStateCode,
      address: body.address !== undefined ? body.address : existing.address,
      phone: body.phone !== undefined ? body.phone : existing.phone,
      placeOfSupply: body.placeOfSupply || existing.placeOfSupply,
      shipTo: body.shipTo ? {
        name: body.shipTo.name || body.partyName || existing.partyName,
        gstin: body.shipTo.gstin !== undefined ? body.shipTo.gstin : (body.gstin || existing.gstin || ''),
        state: body.shipTo.state || body.state || existing.state || 'Gujarat',
        stateCode: body.shipTo.stateCode || partyStateCode || existing.stateCode || '24',
        address: body.shipTo.address !== undefined ? body.shipTo.address : (body.address || existing.address || ''),
        phone: body.shipTo.phone !== undefined ? body.shipTo.phone : (body.phone || existing.phone || '')
      } : (existing.shipTo || {
        name: body.partyName || existing.partyName,
        gstin: body.gstin || existing.gstin || '',
        state: body.state || existing.state || 'Gujarat',
        stateCode: partyStateCode,
        address: body.address || existing.address || '',
        phone: body.phone || existing.phone || ''
      }),
      destination: body.destination !== undefined ? body.destination : existing.destination,
      deliveryNote: body.deliveryNote !== undefined ? body.deliveryNote : existing.deliveryNote,
      deliveryNoteDate: body.deliveryNoteDate !== undefined ? body.deliveryNoteDate : existing.deliveryNoteDate,
      isInterstate,
      paymentMode: body.paymentMode || existing.paymentMode,
      vehicleNo: body.vehicleNo !== undefined ? body.vehicleNo : existing.vehicleNo,
      transporter: body.transporter !== undefined ? body.transporter : existing.transporter,
      distance: body.distance !== undefined ? Number(body.distance) : (existing.distance || 85),
      transporterId: body.transporterId !== undefined ? body.transporterId : (existing.transporterId || ''),
      ewayBillNo: body.ewayBillNo !== undefined ? body.ewayBillNo : (existing.ewayBill?.ewayBillNo || existing.ewayBillNo || ''),
      ewayBill: body.ewayBillNo ? {
        ...(existing.ewayBill || {}),
        status: 'Active (Manual/Portal)',
        ewayBillNo: body.ewayBillNo,
        distance: Number(body.distance || existing.distance || 85),
        vehicleNo: body.vehicleNo || existing.vehicleNo || '',
        transporter: body.transporter || existing.transporter || ''
      } : existing.ewayBill,
      items,
      subTotal: Number(subTotal.toFixed(2)),
      totalCgst: Number(totalCgst.toFixed(2)),
      totalSgst: Number(totalSgst.toFixed(2)),
      totalIgst: Number(totalIgst.toFixed(2)),
      totalGst: Number((totalCgst + totalSgst + totalIgst).toFixed(2)),
      freightCharges,
      roundOff,
      grandTotal,
      amountInWords: numberToIndianWords(grandTotal),
      notes: body.notes !== undefined ? body.notes : existing.notes,
      updatedAt: new Date().toISOString(),
      action: wasSynced ? 'Alter' : 'Create',
      tallySync: {
        ...existing.tallySync,
        synced: false, // Reset so user can push the updated version to Tally!
        lastUpdatedBeforeSync: true
      }
    };

    list[idx] = updatedInvoice;
    await writeInvoices(list);

    res.json(updatedInvoice);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// DELETE invoice
router.delete('/:id', async (req, res) => {
  try {
    let list = await readInvoices();
    const idx = list.findIndex((i) => i.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Invoice not found' });
    const deleted = list.splice(idx, 1)[0];
    await writeInvoices(list);
    res.json({ message: 'Invoice deleted successfully', invoice: deleted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST clear all invoices
router.post('/clear', async (req, res) => {
  try {
    await writeInvoices([]);
    const settings = await readSettings();
    settings.nextInvoiceNumber = 1;
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
    res.json({ success: true, message: 'All invoices cleared and next sequence reset to 1' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
