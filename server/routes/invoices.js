import express from 'express';
import {
  getInvoices,
  getInvoice,
  insertInvoiceTx,
  updateInvoice,
  deleteInvoice,
  clearInvoices,
  withSeqLock,
  getSeqState,
  getSettings,
  getBridgeState,
  extractSeq
} from '../lib/db.js';
import { requireAdmin } from '../lib/auth.js';
import { probe, fetchMaxVoucherNumber, tallyOptionsFromSettings } from '../lib/tallyClient.js';

const router = express.Router();

const DEFAULT_PREFIX = 'YP/26-27/';
const BRIDGE_STALE_MS = 90 * 1000; // 90s - the agent beats every 15s

export { extractSeq };

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

/**
 * Where does the number we are about to hand out come from?
 * The old code returned a hardcoded autoIdentified: true while silently
 * swallowing a failed Tally probe, so a stale 252 looked like a live reading.
 */
async function describeNumberSource() {
  const settings = await getSettings();
  const prefix = settings.invoicePrefix || DEFAULT_PREFIX;
  const seq = await getSeqState();
  const bridge = await getBridgeState();

  const bridgeOnline = Boolean(
    bridge?.lastHeartbeat && Date.now() - new Date(bridge.lastHeartbeat).getTime() < BRIDGE_STALE_MS
  );

  let tally = { reachable: false, checked: false, maxVoucher: bridge?.tallyMaxVoucher || 0, company: bridge?.tallyCompany || null, error: null };

  // Only try a live probe when this process could plausibly reach Tally.
  // On Render the portal cannot see the accountant's localhost:9000 at all.
  const canReachTallyDirectly = !process.env.RENDER;
  if (canReachTallyDirectly) {
    const result = await probe(tallyOptionsFromSettings(settings));
    tally = {
      reachable: result.reachable,
      checked: true,
      maxVoucher: bridge?.tallyMaxVoucher || 0,
      company: result.company || bridge?.tallyCompany || null,
      error: result.error
    };
  }

  const nextSeq = seq.nextValue;
  const source = tally.reachable
    ? 'tally-live'
    : bridgeOnline && bridge?.tallyMaxVoucher
      ? 'tally-bridge'
      : 'database';

  return {
    prefix,
    nextSeq,
    invoiceNo: `${prefix}${nextSeq}`,
    latestIdentified: Math.max(0, nextSeq - 1),
    seq,
    source,
    bridge: {
      online: bridgeOnline,
      lastHeartbeat: bridge?.lastHeartbeat || null,
      lastSyncAt: bridge?.lastSyncAt || null,
      lastResult: bridge?.lastResult || null,
      tallyMaxVoucher: bridge?.tallyMaxVoucher || 0,
      tallyCompany: bridge?.tallyCompany || null
    },
    tally: {
      directProbeSupported: canReachTallyDirectly,
      ...tally
    }
  };
}

router.get('/next-number', async (req, res) => {
  try {
    res.json(await describeNumberSource());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { synced, search } = req.query;
    let list = await getInvoices();

    if (synced !== undefined) {
      const isSynced = synced === 'true';
      list = list.filter((i) => Boolean(i.tallySync?.synced) === isSynced);
    }

    if (search) {
      const q = String(search).toLowerCase();
      list = list.filter(
        (i) =>
          (i.invoiceNo || '').toLowerCase().includes(q) ||
          (i.partyName || '').toLowerCase().includes(q) ||
          (i.gstin || '').toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const inv = await getInvoice(req.params.id);
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });
    res.json(inv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const body = req.body;
    const settings = await getSettings();
    const prefix = settings.invoicePrefix || DEFAULT_PREFIX;

    // Place of Supply & Interstate calculation (Gujarat = 24)
    const partyStateCode = String(body.stateCode || (body.gstin ? body.gstin.slice(0, 2) : '24'));
    const isInterstate = partyStateCode !== '24';

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

    const buildInvoice = (invoiceNo) => ({
      id: `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
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
      shipTo: body.shipTo
        ? {
            name: body.shipTo.name || body.partyName || 'Cash Customer',
            gstin: body.shipTo.gstin !== undefined ? body.shipTo.gstin : body.gstin || '',
            state: body.shipTo.state || body.state || 'Gujarat',
            stateCode: body.shipTo.stateCode || partyStateCode || '24',
            address: body.shipTo.address !== undefined ? body.shipTo.address : body.address || '',
            phone: body.shipTo.phone !== undefined ? body.shipTo.phone : body.phone || ''
          }
        : {
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
      ewayBill:
        (body.ewayBillNo || body.vehicleNo || grandTotal >= 50000)
          ? {
              status: body.ewayBillNo ? 'Active (Manual/Portal)' : 'Applicable (Ready for Tally)',
              ewayBillNo:
                body.ewayBillNo ||
                `24${String(invoiceNo).replace(/\D/g, '').slice(-3).padStart(3, '0')}82500${Math.floor(100 + Math.random() * 900)}`,
              ewayBillDate: body.date || new Date().toISOString().slice(0, 10),
              validUntil: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
              transporter: body.transporter || 'Patel Freight',
              transporterId: body.transporterId || '',
              vehicleNo: body.vehicleNo || '',
              distance: Number(body.distance || 85),
              syncedAt: new Date().toISOString()
            }
          : null,
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
      tallySync: { synced: false, syncTime: null, tallyVoucherNo: null, method: null },
      createdAt: new Date().toISOString()
    });

    // Number allocation and insert happen in one serialised transaction, so two
    // people saving at the same moment can never receive the same number.
    const requested = body.invoiceNo ? String(body.invoiceNo).trim() : null;

    const result = await withSeqLock(async (seq, tx) => {
      let invoiceNo = requested;

      if (invoiceNo) {
        const taken = await seq.isTaken(invoiceNo);
        if (taken) {
          const err = new Error(`Bill number ${invoiceNo} is already used. Pick a different number.`);
          err.code = 'DUPLICATE_INVOICE_NO';
          throw err;
        }
        const custom = extractSeq(invoiceNo);
        if (custom) await seq.bumpTo(custom + 1);
      } else {
        invoiceNo = `${prefix}${seq.current}`;
        await seq.bumpTo(seq.current + 1);
      }

      const invoice = buildInvoice(invoiceNo);
      await insertInvoiceTx(tx, invoice);
      await seq.persist();
      return invoice;
    });

    res.status(201).json(result);
  } catch (err) {
    if (err.code === 'DUPLICATE_INVOICE_NO') {
      return res.status(409).json({ error: err.message, code: err.code });
    }
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const existing = await getInvoice(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Invoice not found' });

    const body = req.body;
    const companyStateCode = '24';
    const partyStateCode = body.gstin && body.gstin.length >= 2 ? body.gstin.slice(0, 2) : body.stateCode || '24';
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
    const invoiceNo = body.invoiceNo ? String(body.invoiceNo).trim() : existing.invoiceNo;

    const updated = {
      ...existing,
      invoiceNo,
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
      shipTo: body.shipTo
        ? {
            name: body.shipTo.name || body.partyName || existing.partyName,
            gstin: body.shipTo.gstin !== undefined ? body.shipTo.gstin : body.gstin || existing.gstin || '',
            state: body.shipTo.state || body.state || existing.state || 'Gujarat',
            stateCode: body.shipTo.stateCode || partyStateCode || existing.stateCode || '24',
            address: body.shipTo.address !== undefined ? body.shipTo.address : body.address || existing.address || '',
            phone: body.shipTo.phone !== undefined ? body.shipTo.phone : body.phone || existing.phone || ''
          }
        : existing.shipTo,
      destination: body.destination !== undefined ? body.destination : existing.destination,
      deliveryNote: body.deliveryNote !== undefined ? body.deliveryNote : existing.deliveryNote,
      deliveryNoteDate: body.deliveryNoteDate !== undefined ? body.deliveryNoteDate : existing.deliveryNoteDate,
      isInterstate,
      paymentMode: body.paymentMode || existing.paymentMode,
      vehicleNo: body.vehicleNo !== undefined ? body.vehicleNo : existing.vehicleNo,
      transporter: body.transporter !== undefined ? body.transporter : existing.transporter,
      distance: body.distance !== undefined ? Number(body.distance) : existing.distance || 85,
      transporterId: body.transporterId !== undefined ? body.transporterId : existing.transporterId || '',
      ewayBillNo:
        body.ewayBillNo !== undefined ? body.ewayBillNo : existing.ewayBill?.ewayBillNo || existing.ewayBillNo || '',
      ewayBill: body.ewayBillNo
        ? {
            ...(existing.ewayBill || {}),
            status: 'Active (Manual/Portal)',
            ewayBillNo: body.ewayBillNo,
            distance: Number(body.distance || existing.distance || 85),
            vehicleNo: body.vehicleNo || existing.vehicleNo || '',
            transporter: body.transporter || existing.transporter || ''
          }
        : existing.ewayBill,
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
        synced: false,
        lastUpdatedBeforeSync: true
      }
    };

    try {
      await updateInvoice(updated);
    } catch (err) {
      if (err.code === 'DUPLICATE_INVOICE_NO') {
        return res.status(409).json({ error: err.message, code: err.code });
      }
      throw err;
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const deleted = await deleteInvoice(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Invoice not found' });
    res.json({ message: 'Invoice deleted successfully', invoice: deleted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Delete all invoices but NEVER rewind the number counter.
 *
 * The old version set nextInvoiceNumber back to 1, which guaranteed the portal
 * would start reissuing numbers Tally had already used. The counter is now
 * monotonic and can only be moved by raiseSeqTo() or an explicit, confirmed
 * reset.
 */
router.post('/clear', requireAdmin, async (req, res) => {
  try {
    await clearInvoices();
    const seq = await getSeqState();
    res.json({
      success: true,
      message: `All invoices deleted. Numbering continues from ${seq.nextValue} - the counter was not reset.`,
      nextSeq: seq.nextValue
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Explicit counter move. Requires Super Admin and an echoed confirmation so it
 * cannot happen by accident.
 */
router.post('/set-next-number', requireAdmin, async (req, res) => {
  try {
    const { value, confirm } = req.body || {};
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1) {
      return res.status(400).json({ error: 'value must be a positive whole number' });
    }
    if (confirm !== `SET-${n}`) {
      return res.status(400).json({ error: `Confirmation required: send confirm: "SET-${n}"` });
    }
    const { raiseSeqTo } = await import('../lib/db.js');
    const state = await raiseSeqTo(n, `manual:${req.user.sub}`);
    res.json({ success: true, nextSeq: state.nextValue, ...state });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export { describeNumberSource, fetchMaxVoucherNumber };
export default router;
