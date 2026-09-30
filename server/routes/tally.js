import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildTallyEnvelopeXml, buildVoucherXml, buildMastersXml } from '../lib/tallyXmlBuilder.js';
import { getInvoices, getInvoice, updateInvoice, getSettings, getBridgeState } from '../lib/db.js';
import {
  postXml,
  probe,
  getActiveCompany,
  fetchMaxVoucherNumber,
  mastersImportEnvelope,
  voucherImportEnvelope,
  parseImportResponse,
  tallyOptionsFromSettings
} from '../lib/tallyClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

const BRIDGE_STALE_MS = 90 * 1000;

/**
 * The portal normally runs on a cloud host and cannot see the accountant's
 * localhost:9000. Tally is reached either directly (local installs) or through
 * the bridge agent running on the PC that has Tally open.
 */
async function tallyContext() {
  const settings = await getSettings();
  const opts = tallyOptionsFromSettings(settings);
  const reach = await probe(opts);
  const bridge = await getBridgeState();
  const bridgeOnline = Boolean(
    bridge?.lastHeartbeat && Date.now() - new Date(bridge.lastHeartbeat).getTime() < BRIDGE_STALE_MS
  );
  return {
    settings,
    opts,
    reach,
    bridge,
    bridgeOnline,
    company: reach.company || bridge?.tallyCompany || settings?.tally?.companyName || 'Sanmati Solution',
    canPush: reach.reachable
  };
}

/** Ensure the ledger and stock item exist in Tally before the voucher. */
async function ensureMasters(invoice, company) {
  const settings = await getSettings();
  const withCompany = { ...settings, tally: { ...settings.tally, companyName: company } };
  await postXml(mastersImportEnvelope(buildMastersXml([invoice], withCompany), company), {
    timeoutMs: 10000
  });
  // Tally needs a moment to index new masters before a voucher can reference them.
  await new Promise((r) => setTimeout(r, 400));
}

/**
 * Create one voucher in Tally, refusing to duplicate a number that is already
 * there. Tally only blocks duplicates when its own prevent-duplicates setting is
 * enabled, so we verify ourselves first.
 */
async function pushVoucher(invoice, { opts, company }) {
  const { numbers } = await fetchMaxVoucherNumber(opts);
  if (numbers.includes(invoice.invoiceNo)) {
    const err = new Error(
      `Tally already holds a Sales voucher numbered ${invoice.invoiceNo}. Not creating a duplicate.`
    );
    err.code = 'DUPLICATE_IN_TALLY';
    throw err;
  }

  await ensureMasters(invoice, company);

  const settings = await getSettings();
  const withCompany = { ...settings, tally: { ...settings.tally, companyName: company } };
  const responseText = await postXml(
    voucherImportEnvelope(buildVoucherXml(invoice, withCompany), company),
    { ...opts, timeoutMs: 10000 }
  );
  return { responseText, ...parseImportResponse(responseText) };
}

// ---------------------------------------------------------------------------
// 1. Status
// ---------------------------------------------------------------------------

router.get('/status', async (req, res) => {
  try {
    const { opts, reach, bridge, bridgeOnline, company } = await tallyContext();
    const canSync = reach.reachable || bridgeOnline;

    res.json({
      online: canSync,
      tallyReachable: reach.reachable,
      bridgeAgentOnline: bridgeOnline,
      host: opts.host,
      port: opts.port,
      configuredCompany: (await getSettings()).tally?.companyName || 'Sanmati Solution',
      activeCompany: company,
      latencyMs: reach.latencyMs,
      lastTallyReading: bridge?.lastSyncAt || null,
      tallyMaxVoucher: bridge?.tallyMaxVoucher || 0,
      message: reach.reachable
        ? `Tally Prime is reachable on ${opts.host}:${opts.port} (company "${company}").`
        : bridgeOnline
          ? 'The portal cannot reach Tally directly, but the local bridge agent is online and will sync through it.'
          : `Tally Prime is not reachable on ${opts.host}:${opts.port} and the bridge agent is offline. Open Tally, press F1 > Settings > Connectivity > tick "Enable", then start the bridge agent on that PC.`,
      error: reach.reachable ? null : reach.error
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// 2. XML exports (pulled by the TDL over HTTP, so it passes ?key=BRIDGE_KEY)
// ---------------------------------------------------------------------------

router.get('/export-xml', async (req, res) => {
  try {
    const { all } = req.query;
    const settings = await getSettings();
    let invoices = await getInvoices();

    if (all !== 'true') {
      const pending = invoices.filter((i) => !i.tallySync?.synced);
      if (pending.length > 0) invoices = pending;
    }

    const { company } = await tallyContext();
    const effectiveSettings = { ...settings, tally: { ...settings.tally, companyName: company } };

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="YamunaPlastics_Tally_Import_${Date.now()}.xml"`
    );
    res.send(buildTallyEnvelopeXml(invoices, effectiveSettings, true));
  } catch (err) {
    res.status(500).send(`<!-- Error: ${err.message} -->`);
  }
});

router.get('/invoice-xml/:id', async (req, res) => {
  try {
    const inv = await getInvoice(req.params.id);
    if (!inv) return res.status(404).send('<!-- Invoice not found -->');

    const settings = await getSettings();
    const { company } = await tallyContext();
    const effectiveSettings = { ...settings, tally: { ...settings.tally, companyName: company } };

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.send(buildTallyEnvelopeXml([inv], effectiveSettings, true));
  } catch (err) {
    res.status(500).send(`<!-- Error: ${err.message} -->`);
  }
});

// ---------------------------------------------------------------------------
// 3. Pending bills
// ---------------------------------------------------------------------------

router.get('/pending-bills', async (req, res) => {
  try {
    const invoices = await getInvoices();
    const pending = invoices.filter((i) => !i.tallySync?.synced);
    res.json({
      count: pending.length,
      pendingBills: pending.map((p) => ({
        id: p.id,
        invoiceNo: p.invoiceNo,
        date: p.date,
        partyName: p.partyName,
        grandTotal: p.grandTotal,
        itemsCount: p.items?.length || 0,
        xmlUrl: `/api/tally/invoice-xml/${p.id}`
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// 4. Single push
// ---------------------------------------------------------------------------

router.post('/sync/:id', async (req, res) => {
  try {
    const invoice = await getInvoice(req.params.id);
    if (!invoice) return res.status(404).json({ success: false, error: 'Invoice not found' });

    const ctx = await tallyContext();
    if (!ctx.canPush) {
      return res.status(503).json({
        success: false,
        error: 'Tally is not reachable and no bridge agent is online, so this bill cannot be pushed yet. It stays in the pending list until one of them is up.'
      });
    }

    const { opts, company } = ctx;
    let responseText = '';
    let message = '';

    try {
      const result = await pushVoucher(invoice, { opts, company });
      responseText = result.responseText;
      if ((result.created > 0 || result.altered > 0) && result.errors === 0) {
        message = `Bill #${invoice.invoiceNo} entered into Tally Prime company "${company}".`;
      } else {
        return res.status(422).json({
          success: false,
          invoiceNo: invoice.invoiceNo,
          error: result.lineError || 'Tally rejected the voucher.',
          tallyResponseSnippet: responseText.slice(0, 400)
        });
      }
    } catch (err) {
      if (err.code === 'DUPLICATE_IN_TALLY') {
        return res.status(409).json({ success: false, code: err.code, error: err.message });
      }
      return res.status(503).json({ success: false, error: err.message });
    }

    invoice.tallySync = {
      synced: true,
      syncTime: new Date().toISOString(),
      tallyVoucherNo: invoice.invoiceNo,
      tallyCompany: company,
      method: 'Direct HTTP Push'
    };
    try {
      await queryAndPopulateEwayBill(invoice, company, opts);
    } catch (eErr) {
      console.warn('Auto e-way bill lookup notice:', eErr.message);
    }
    await updateInvoice(invoice);

    res.json({ success: true, invoiceNo: invoice.invoiceNo, company, message });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// 5. Bulk push
// ---------------------------------------------------------------------------

router.post('/sync-all', async (req, res) => {
  try {
    const invoices = await getInvoices();
    const pending = invoices.filter((i) => !i.tallySync?.synced);

    if (pending.length === 0) {
      return res.json({ success: true, syncedCount: 0, message: 'No pending bills. Everything is in sync.' });
    }

    const ctx = await tallyContext();
    if (!ctx.canPush) {
      return res.status(503).json({
        success: false,
        error: 'Tally is not reachable and no bridge agent is online. Bills stay pending until one is up.'
      });
    }

    const { opts, company } = ctx;
    let syncedCount = 0;
    const errors = [];

    for (const inv of pending) {
      try {
        const result = await pushVoucher(inv, { opts, company });
        if ((result.created > 0 || result.altered > 0) && result.errors === 0) {
          inv.tallySync = {
            synced: true,
            syncTime: new Date().toISOString(),
            tallyVoucherNo: inv.invoiceNo,
            tallyCompany: company,
            method: 'Bulk Direct Push'
          };
          try {
            await queryAndPopulateEwayBill(inv, company, opts);
          } catch {}
          await updateInvoice(inv);
          syncedCount++;
        } else {
          errors.push(`${inv.invoiceNo}: ${result.lineError || 'rejected by Tally'}`);
        }
      } catch (err) {
        if (err.code === 'DUPLICATE_IN_TALLY') {
          // Already in Tally under this number, so treat it as done and flag it.
          inv.tallySync = {
            ...(inv.tallySync || {}),
            synced: true,
            syncTime: new Date().toISOString(),
            tallyVoucherNo: inv.invoiceNo,
            method: 'Already present in Tally'
          };
          await updateInvoice(inv);
          errors.push(`${inv.invoiceNo}: already exists in Tally, marked synced without creating a duplicate`);
        } else {
          errors.push(`${inv.invoiceNo}: ${err.message}`);
        }
      }
    }

    res.json({
      success: syncedCount > 0 || errors.length === 0,
      syncedCount,
      totalPending: pending.length,
      company,
      errors: errors.length ? errors : undefined,
      message: `Pushed ${syncedCount} of ${pending.length} pending bills into Tally Prime ("${company}").`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// 6. Mark synced (called by the bridge agent after a successful local push)
// ---------------------------------------------------------------------------

router.post('/mark-synced/:id', async (req, res) => {
  try {
    const invoice = await getInvoice(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const { method, tallyVoucherNo } = req.body || {};
    invoice.tallySync = {
      ...(invoice.tallySync || {}),
      synced: true,
      syncTime: new Date().toISOString(),
      tallyVoucherNo: tallyVoucherNo || invoice.invoiceNo,
      method: method || 'TDL In-App Sync'
    };
    await updateInvoice(invoice);
    res.json({ success: true, invoice });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// 7. e-Way Bill lookups
// ---------------------------------------------------------------------------

export async function queryAndPopulateEwayBill(invoice, companyName, opts = {}) {
  const queryXml = `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Voucher Register</REPORTNAME>
        <STATICVARIABLES>
          <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
          <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
          <SVCURRENTCOMPANY>${companyName}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>`;

  let tallyResp = '';
  try {
    tallyResp = await postXml(queryXml, { ...opts, timeoutMs: 10000 });
  } catch (netErr) {
    console.warn('Tally e-way bill query notice:', netErr.message);
  }

  let ewbNo = '';
  let ewbDate = '';
  let ewbValidTill = '';
  let irn = '';
  let ackNo = '';
  let ackDate = '';

  if (tallyResp) {
    const vchRegex = /<VOUCHER [^>]*>([\s\S]*?)<\/VOUCHER>/gi;
    let match;
    while ((match = vchRegex.exec(tallyResp)) !== null) {
      const vchXml = match[1];
      const vchNo = (vchXml.match(/<VOUCHERNUMBER>([^<]+)<\/VOUCHERNUMBER>/i) || [])[1];
      const refNo = (vchXml.match(/<REFERENCE>([^<]+)<\/REFERENCE>/i) || [])[1];
      if (vchNo === invoice.invoiceNo || refNo === invoice.invoiceNo) {
        ewbNo = (vchXml.match(/<EWAYBILLNO>([^<]+)<\/EWAYBILLNO>/i) || vchXml.match(/<BILLNO>([^<]+)<\/BILLNO>/i) || [])[1] || '';
        ewbDate = (vchXml.match(/<EWAYBILLDATE>([^<]+)<\/EWAYBILLDATE>/i) || [])[1] || '';
        ewbValidTill = (vchXml.match(/<EWAYBILLVALIDTILL>([^<]+)<\/EWAYBILLVALIDTILL>/i) || [])[1] || '';
        irn = (vchXml.match(/<IRN>([^<]+)<\/IRN>/i) || [])[1] || '';
        ackNo = (vchXml.match(/<ACKNO>([^<]+)<\/ACKNO>/i) || [])[1] || '';
        ackDate = (vchXml.match(/<ACKDATE>([^<]+)<\/ACKDATE>/i) || [])[1] || '';
        break;
      }
    }
  }

  if (ewbNo && ewbNo.trim()) {
    invoice.ewayBill = {
      status: 'Generated in Tally',
      ewayBillNo: ewbNo.trim(),
      ewayBillDate: ewbDate || invoice.date,
      validUntil: ewbValidTill || '',
      transporter: invoice.transporter || 'Patel Freight',
      transporterId: invoice.transporterId || '',
      vehicleNo: invoice.vehicleNo || '',
      distance: invoice.distance || 85,
      syncedAt: new Date().toISOString()
    };
  } else if (!invoice.ewayBill?.ewayBillNo && invoice.ewayBillNo) {
    invoice.ewayBill = {
      status: 'Active (Manual/Portal)',
      ewayBillNo: invoice.ewayBillNo,
      ewayBillDate: invoice.date,
      validUntil: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
      transporter: invoice.transporter || 'Patel Freight',
      transporterId: invoice.transporterId || '',
      vehicleNo: invoice.vehicleNo || '',
      distance: invoice.distance || 85,
      syncedAt: new Date().toISOString()
    };
  }

  if (irn && !invoice.irn) invoice.irn = irn;
  if (ackNo && !invoice.ackNo) invoice.ackNo = ackNo;
  if (ackDate && !invoice.ackDate) invoice.ackDate = ackDate;

  return invoice.ewayBill;
}

router.post('/fetch-eway-bill/:id', async (req, res) => {
  try {
    const invoice = await getInvoice(req.params.id);
    if (!invoice) return res.status(404).json({ success: false, error: 'Invoice not found' });

    const { opts, company } = await tallyContext();
    await queryAndPopulateEwayBill(invoice, company, opts);
    await updateInvoice(invoice);

    res.json({
      success: true,
      invoiceNo: invoice.invoiceNo,
      ewayBill: invoice.ewayBill,
      message: `e-Way Bill #${invoice.ewayBill?.ewayBillNo || 'n/a'} saved for Bill #${invoice.invoiceNo}.`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/test-eway-connection', async (req, res) => {
  try {
    const settings = await getSettings();
    const ewbCfg = settings.ewayBill || {};
    res.json({
      success: true,
      gstin: ewbCfg.gstin || settings.company?.gstin,
      provider: ewbCfg.gspProvider || 'NIC Direct Portal / Tally GSP',
      status: ewbCfg.enabled ? 'Configured' : 'Disabled',
      message: ewbCfg.enabled
        ? 'e-Way Bill generation is enabled. Numbers are picked up from Tally after a bill is pushed.'
        : 'e-Way Bill generation is currently disabled in settings.'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/sync-all-eway-bills', async (req, res) => {
  try {
    const invoices = await getInvoices();
    const { opts, company } = await tallyContext();
    let updated = 0;
    for (const inv of invoices) {
      await queryAndPopulateEwayBill(inv, company, opts);
      await updateInvoice(inv);
      updated++;
    }
    res.json({ success: true, updatedCount: updated, totalInvoices: invoices.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// 8. Downloadable helper files
// ---------------------------------------------------------------------------

function cloudUrlFromRequest(req) {
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.get('host');
  if (process.env.CLOUD_URL) return process.env.CLOUD_URL;
  if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
    return `${proto}://${host}`;
  }
  return 'https://yamuna.sanmatisolution.com';
}

async function sendScriptFile(req, res, filename, contentType) {
  try {
    const file = path.join(__dirname, '..', '..', 'scripts', filename);
    let content = await fs.readFile(file, 'utf8');
    const target = cloudUrlFromRequest(req);
    content = content
      .replace(/\$CloudUrl\s*=\s*"[^"]*"/, `$CloudUrl = "${target}"`)
      .replace(/\$CloudUrl\s*=\s*'[^']*'/, `$CloudUrl = '${target}'`);

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', contentType);
    res.send(content);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read file: ' + err.message });
  }
}

router.get('/download-bridge-bat', (req, res) => sendScriptFile(req, res, 'Yamuna-Tally-Bridge.bat', 'application/x-bat'));
router.get('/download-bridge-ps1', (req, res) => sendScriptFile(req, res, 'Yamuna-Tally-Bridge.ps1', 'text/plain'));

router.get('/download-tdl', (req, res) => {
  const file = path.join(__dirname, '..', '..', 'tdl', 'YamunaPlastics_Sync.tdl');
  res.download(file, 'YamunaPlastics_Sync.tdl');
});

export default router;
