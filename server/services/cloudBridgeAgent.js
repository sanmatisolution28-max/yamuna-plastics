/**
 * Local Tally bridge agent.
 *
 * This is the only component that can see Tally. It runs on the accountant's PC
 * (alongside the local server, or standalone) and is the reason the cloud portal
 * can stay in sync at all: the cloud cannot reach that PC's localhost:9000.
 *
 * Every cycle it:
 *   1. reads Tally masters (customers + stock items) and voucher numbers
 *   2. pushes them up to the portal
 *   3. pulls pending bills from the portal and creates them in Tally,
 *      refusing any voucher number Tally already holds
 */

import fs from 'fs';
import path from 'path';
import {
  postXml,
  fetchMaxVoucherNumber,
  fetchDebtorsXml,
  fetchStockItemsXml,
  voucherImportEnvelope,
  parseImportResponse
} from '../lib/tallyClient.js';

const CLOUD_URL = (process.env.CLOUD_URL || 'https://yamuna.sanmatisolution.com').replace(/\/$/, '');
const TALLY_PORT = Number(process.env.TALLY_PORT || 9000);
const BRIDGE_KEY = process.env.BRIDGE_KEY || '';
const MASTERS_WATCH_FILE = process.env.MASTERS_WATCH_FILE || 'C:\\TallyPrime\\YamunaPlastics_Masters.xml';
const SYNC_INTERVAL_MS = Number(process.env.BRIDGE_SYNC_INTERVAL_MS || 15000);
const POLL_INTERVAL_MS = Number(process.env.BRIDGE_POLL_INTERVAL_MS || 2000);

const TALLY_OPTS = { host: 'localhost', port: TALLY_PORT };

/** Every cloud call carries the shared key so the API accepts the agent. */
function cloudHeaders(extra = {}) {
  return {
    'Content-Type': 'application/json',
    ...(BRIDGE_KEY ? { 'X-Bridge-Key': BRIDGE_KEY } : {}),
    ...extra
  };
}

async function cloudGet(pathname) {
  const res = await fetch(`${CLOUD_URL}${pathname}`, {
    headers: cloudHeaders(),
    signal: AbortSignal.timeout(10000)
  });
  if (!res.ok) throw new Error(`${pathname} returned ${res.status}`);
  return res.json();
}

async function cloudPost(pathname, body, contentType = 'application/json') {
  const res = await fetch(`${CLOUD_URL}${pathname}`, {
    method: 'POST',
    headers: cloudHeaders({ 'Content-Type': contentType }),
    body: typeof body === 'string' ? body : JSON.stringify(body),
    signal: AbortSignal.timeout(15000)
  });
  const text = await res.text();
  let data = {};
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text.slice(0, 200) };
  }
  if (!res.ok) throw new Error(data.error || `${pathname} returned ${res.status}`);
  return data;
}

let isSyncing = false;
let lastMastersPush = { at: 0, size: 0 };

/** Push whatever Tally wrote to the masters export file. */
async function pushMastersFileIfChanged() {
  let stat;
  try {
    stat = fs.statSync(MASTERS_WATCH_FILE);
  } catch {
    return null; // file not there yet - the TDL export has not been run
  }
  if (stat.size === lastMastersPush.size && Math.abs(stat.mtimeMs - lastMastersPush.at) < 1000) {
    return null; // unchanged since last push
  }

  const xml = fs.readFileSync(MASTERS_WATCH_FILE, 'utf8');
  if (!xml.trim()) return null;

  const result = await cloudPost('/api/masters/tally-push', xml, 'application/xml');
  lastMastersPush = { at: stat.mtimeMs, size: stat.size };
  console.log(`[Bridge] pushed masters file (${stat.size} bytes): ${result.message || 'ok'}`);
  return result;
}

/**
 * Create pending portal bills in Tally.
 * Duplicate numbers are skipped, not pushed - a number already in Tally is
 * never created twice.
 */
async function pushPendingBills() {
  const { pendingBills = [] } = await cloudGet('/api/tally/pending-bills');
  if (pendingBills.length === 0) return { synced: 0, skipped: 0, total: 0 };

  const { numbers } = await fetchMaxVoucherNumber(TALLY_OPTS);
  const existing = new Set(numbers);

  let synced = 0;
  let skipped = 0;
  const errors = [];

  for (const bill of pendingBills) {
    try {
      if (existing.has(bill.invoiceNo)) {
        await cloudPost(`/api/tally/mark-synced/${bill.id}`, {
          method: '1-Click Cloud Bridge (already in Tally)',
          tallyVoucherNo: bill.invoiceNo
        });
        skipped++;
        console.log(`[Bridge] ${bill.invoiceNo} already exists in Tally - marked synced, no duplicate created.`);
        continue;
      }

      const xmlRes = await fetch(`${CLOUD_URL}/api/tally/invoice-xml/${bill.id}`, {
        headers: cloudHeaders(),
        signal: AbortSignal.timeout(10000)
      });
      const voucherXml = await xmlRes.text();
      if (!xmlRes.ok || voucherXml.includes('<!-- Error')) {
        throw new Error(`could not fetch voucher XML (${voucherXml.slice(0, 120)})`);
      }

      const settings = await cloudGet('/api/settings').catch(() => null);
      const company =
        settings?.tally?.companyName || 'Sanmati Solution';

      const responseText = await postXml(voucherImportEnvelope(voucherXml, company), {
        ...TALLY_OPTS,
        timeoutMs: 15000
      });
      const result = parseImportResponse(responseText);

      if ((result.created > 0 || result.altered > 0) && result.errors === 0) {
        existing.add(bill.invoiceNo);
        await cloudPost(`/api/tally/mark-synced/${bill.id}`, {
          method: '1-Click Cloud Bridge',
          tallyVoucherNo: bill.invoiceNo
        });
        synced++;
      } else {
        errors.push(`${bill.invoiceNo}: ${result.lineError || 'Tally rejected the voucher'}`);
      }
    } catch (err) {
      errors.push(`${bill.invoiceNo}: ${err.message}`);
    }
  }

  return { synced, skipped, total: pendingBills.length, errors };
}

export async function executeTallySyncCycle() {
  if (isSyncing) return { success: false, reason: 'Sync already in progress' };
  isSyncing = true;

  try {
    const [debtors, stock, vouchers] = await Promise.allSettled([
      fetchDebtorsXml({ ...TALLY_OPTS, timeoutMs: 10000 }),
      fetchStockItemsXml({ ...TALLY_OPTS, timeoutMs: 10000 }),
      fetchMaxVoucherNumber({ ...TALLY_OPTS, timeoutMs: 10000 })
    ]);

    if ([debtors, stock, vouchers].every((r) => r.status === 'rejected')) {
      throw new Error(
        `Could not reach Tally Prime on localhost:${TALLY_PORT}. Open Tally and press F1 > Settings > Connectivity > Enable.`
      );
    }

    // Tell the portal what Tally's highest voucher number is. This is what keeps
    // the portal's next bill number ahead of Tally.
    const voucherData = vouchers.status === 'fulfilled' ? vouchers.value : { max: 0, count: 0, numbers: [] };
    let tallyCompany = null;
    try {
      const settings = await cloudGet('/api/settings');
      tallyCompany = settings?.tally?.companyName || null;
    } catch {
      /* not fatal */
    }

    await cloudPost('/api/masters/tally-reading', {
      maxVoucher: voucherData.max,
      voucherCount: voucherData.count,
      company: tallyCompany
    });

    // Push masters (from Tally directly, and from the TDL export file if present).
    let mastersResult = null;
    const combinedXml = `${debtors.status === 'fulfilled' ? debtors.value : ''}\n${
      stock.status === 'fulfilled' ? stock.value : ''
    }`;
    if (combinedXml.trim()) {
      mastersResult = await cloudPost('/api/masters/tally-push', combinedXml, 'application/xml');
    }
    const fileResult = await pushMastersFileIfChanged().catch((e) => {
      console.warn('[Bridge] masters file push notice:', e.message);
      return null;
    });

    // Push pending portal bills into Tally.
    const bills = await pushPendingBills();

    return {
      success: true,
      totalParties: mastersResult?.partiesCount ?? null,
      totalItems: mastersResult?.itemsCount ?? null,
      latestTallyVoucher: voucherData.max || null,
      tallyMaxVoucher: voucherData.max || null,
      tallyCompany,
      syncedBillsCount: bills.synced,
      skippedBillsCount: bills.skipped,
      errors: bills.errors?.length ? bills.errors : undefined,
      message:
        `Synced with Tally: ${bills.synced} bill(s) pushed, ${bills.skipped} already present, ` +
        `latest Tally voucher #${voucherData.max || 0}.`
    };
  } catch (err) {
    return { success: false, error: err.message };
  } finally {
    isSyncing = false;
  }
}

export function startCloudBridgeAgent() {
  if (process.env.RENDER) {
    console.log('[Bridge] Running on Render cloud - the local polling agent is disabled here.');
    return;
  }
  if (!BRIDGE_KEY) {
    console.warn('[Bridge] BRIDGE_KEY is not set. Cloud calls from this PC will be rejected.');
  }

  console.log(`[Bridge] Watching ${CLOUD_URL} and Tally on localhost:${TALLY_PORT}.`);

  const cycle = async () => {
    try {
      const result = await executeTallySyncCycle();
      if (result.success) {
        await cloudPost('/api/bridge/complete', {
          success: true,
          result
        }).catch(() => {});
      }
    } catch {
      /* Tally offline - stay quiet, the next cycle retries */
    }
  };

  setInterval(cycle, SYNC_INTERVAL_MS);
  setTimeout(cycle, 3000);

  // Command polling keeps the 1-click button in the UI responsive.
  setInterval(async () => {
    try {
      await cloudPost('/api/bridge/heartbeat', {}).catch(() => {});
      const poll = await cloudGet('/api/bridge/poll');
      if (poll.hasPending && poll.command) {
        console.log(`[Bridge] running command ${poll.command.id}`);
        const result = await executeTallySyncCycle();
        await cloudPost('/api/bridge/complete', {
          commandId: poll.command.id,
          success: result.success,
          result,
          error: result.error
        }).catch(() => {});
      }
    } catch {
      /* network blip */
    }
  }, POLL_INTERVAL_MS);
}
