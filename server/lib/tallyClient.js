/**
 * Single place that knows how to talk to Tally Prime's HTTP server.
 *
 * Everything here either succeeds or throws. Nothing swallows its own errors -
 * the old getActiveTallyCompany() caught everything and returned null, which the
 * status endpoint then read as "connected", so the UI showed a green badge even
 * when Tally was completely unreachable.
 */

export const DEFAULT_TALLY_HOST = 'localhost';
export const DEFAULT_TALLY_PORT = 9000;

function envelope(id, collection, fetchFields, extra = '') {
  return `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>${id}</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        ${extra}
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="${id}">
            <TYPE>${collection.type}</TYPE>
            ${collection.childOf ? `<CHILDOF>${collection.childOf}</CHILDOF>` : ''}
            ${collection.belongsTo ? '<BELONGSTO>Yes</BELONGSTO>' : ''}
            <FETCH>${fetchFields}</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
}

export const DEBTOR_QUERY = envelope(
  'DebtorCollection',
  { type: 'Ledger', childOf: '$$GroupSundryDebtors', belongsTo: true },
  'NAME, PARENT, PARTYGSTIN, STATENAME, LEDSTATENAME, ADDRESS.LIST, ADDRESS, PINCODE, LEDGERPHONE, LEDGERMOBILE'
);

export const STOCK_QUERY = envelope(
  'StockCollection',
  { type: 'StockItem' },
  'NAME, BASEUNITS, RATE, OPENINGRATE, CLOSINGRATE, HSNCODE, HSNDETAILS, GSTRATEDETAILS, STANDARDCOST, STANDARDPRICE, LASTSALERATE, PARENT, CATEGORY, DESCRIPTION, PARTNO, CLOSINGBALANCE, OPENINGBALANCE, GSTRATE, INTEGRATEDTAX, MAILINGNAME'
);

export const VOUCHER_QUERY = envelope(
  'SalesVoucherCollection',
  { type: 'Voucher' },
  'VOUCHERNUMBER, DATE, PARTYLEDGERNAME',
  `<SVFROMDATE>20000101</SVFROMDATE>
         <SVTODATE>20991231</SVTODATE>`
);

const COMPANY_QUERY = `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>Company</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
    </DESC>
  </BODY>
</ENVELOPE>`;

/** POST raw XML to Tally. Throws on network failure or non-2xx. */
export async function postXml(xml, { host = DEFAULT_TALLY_HOST, port = DEFAULT_TALLY_PORT, timeoutMs = 6000 } = {}) {
  const res = await fetch(`http://${host}:${port}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Content-Length': Buffer.byteLength(xml).toString()
    },
    body: xml,
    signal: AbortSignal.timeout(timeoutMs)
  });

  if (!res.ok) {
    throw new Error(`Tally HTTP server returned ${res.status} ${res.statusText}`);
  }
  const text = await res.text();
  if (/<ERRORS>\s*\d+\s*<\/ERRORS>/i.test(text) && /<LINEERROR>/i.test(text)) {
    const m = text.match(/<LINEERROR>([\s\S]*?)<\/LINEERROR>/i);
    throw new Error(`Tally rejected the request: ${m ? m[1].trim() : 'unknown error'}`);
  }
  return text;
}

/**
 * Name of the company currently open in Tally, or null if Tally answered but
 * did not name a company. Throws if Tally is unreachable.
 */
export async function getActiveCompany(opts) {
  const text = await postXml(COMPANY_QUERY, opts);
  const m =
    text.match(/<COMPANY NAME="([^"]+)"/i) ||
    text.match(/<NAME TYPE="String">([^<]+)<\/NAME>/i);
  return m?.[1] ? m[1].replace(/&amp;/g, '&').trim() : null;
}

/**
 * Honest reachability check. Never reports reachable without a real round trip.
 */
export async function probe(opts) {
  const started = Date.now();
  try {
    const company = await getActiveCompany(opts);
    return {
      reachable: true,
      company,
      latencyMs: Date.now() - started,
      error: null
    };
  } catch (err) {
    return {
      reachable: false,
      company: null,
      latencyMs: Date.now() - started,
      error: err.message
    };
  }
}

/** Every voucher number in Tally. */
export async function fetchVoucherNumbers(opts) {
  const text = await postXml(VOUCHER_QUERY, opts);
  return [...text.matchAll(/<VOUCHERNUMBER[^>]*>([^<]+)<\/VOUCHERNUMBER>/gi)].map((m) => m[1].trim());
}

/** Highest trailing number across Tally's voucher numbers. */
export async function fetchMaxVoucherNumber(opts) {
  const numbers = await fetchVoucherNumbers(opts);
  let max = 0;
  for (const n of numbers) {
    const m = n.match(/(\d+)$/);
    if (m) {
      const v = parseInt(m[1], 10);
      if (!Number.isNaN(v) && v > max) max = v;
    }
  }
  return { max, count: numbers.length, numbers };
}

/** Does Tally already hold a voucher with this exact number? */
export async function voucherExists(invoiceNo, opts) {
  const { numbers } = await fetchMaxVoucherNumber(opts);
  return numbers.includes(invoiceNo);
}

export async function fetchDebtorsXml(opts) {
  return postXml(DEBTOR_QUERY, opts);
}

export async function fetchStockItemsXml(opts) {
  return postXml(STOCK_QUERY, opts);
}

/** Tally import envelope for a set of masters. */
export function mastersImportEnvelope(mastersXml, companyName) {
  return `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>All Masters</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${companyName}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        ${mastersXml}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

/** Tally import envelope for a voucher. */
export function voucherImportEnvelope(voucherXml, companyName) {
  return `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${companyName}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        ${voucherXml}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

/** Parse Tally's <CREATED>/<ALTERED>/<ERRORS> response counters. */
export function parseImportResponse(text) {
  return {
    created: Number((text.match(/<CREATED>(\d+)<\/CREATED>/) || [])[1] || 0),
    altered: Number((text.match(/<ALTERED>(\d+)<\/ALTERED>/) || [])[1] || 0),
    errors: Number((text.match(/<ERRORS>(\d+)<\/ERRORS>/) || [])[1] || 0),
    lineError: (text.match(/<LINEERROR>([\s\S]*?)<\/LINEERROR>/i) || [])[1]?.trim() || null
  };
}

export function tallyOptionsFromSettings(settings = {}) {
  return {
    host: settings?.tally?.host || DEFAULT_TALLY_HOST,
    port: settings?.tally?.port || DEFAULT_TALLY_PORT
  };
}
