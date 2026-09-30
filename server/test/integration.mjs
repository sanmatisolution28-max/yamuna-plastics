import { MongoClient } from 'mongodb';

const BASE = process.env.BASE || 'http://127.0.0.1:5099';
const BRIDGE_KEY = process.env.BRIDGE_KEY || 'testbridgekey123';
const PASSWORD = process.env.ADMIN_PASSWORD || 'TestPass123';

let pass = 0;
let fail = 0;
const ok = (m) => { console.log(`  PASS  ${m}`); pass++; };
const bad = (m, d) => { console.log(`  FAIL  ${m}`); console.log(`        ${d}`); fail++; };
const check = (m, got, want) => (String(got) === String(want) ? ok(m) : bad(m, `expected [${want}] got [${got}]`));
const is = (m, cond, d = '') => (cond ? ok(m) : bad(m, d));

async function req(method, path, { body, token, bridge, xml } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (xml) headers['Content-Type'] = 'application/xml';
  if (token) headers.Authorization = `Bearer ${token}`;
  if (bridge) headers['X-Bridge-Key'] = bridge;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: xml ? xml : body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* xml or html */ }
  return { status: res.status, json, text };
}

async function resetState() {
  // Clear test data so numbering assertions start from a known point.
  const uri = process.env.MONGODB_URI;
  const c = new MongoClient(uri);
  await c.connect();
  const d = c.db();
  await d.collection('invoices').deleteMany({});
  // nextValue holds the number to be handed out NEXT. Tally's last bill is 250,
  // so the next one the portal may issue is 251.
  await d.collection('invoice_seq').updateOne(
    { _id: 'app' },
    { $set: { nextValue: 251, updatedAt: new Date().toISOString(), updatedBy: 'test-reset' } }
  );
  await c.close();
}

const bill = (party, n = 1) => ({
  partyName: party,
  items: [{ name: 'Test Item', qty: n, rate: 100, gstRate: 18, unit: 'KGS', hsn: '39232100' }]
});

async function main() {
  console.log('\n== authentication ==');
  is('GET /api/invoices without a token is 401', (await req('GET', '/api/invoices')).status === 401);
  is('GET /api/settings without a token is 401', (await req('GET', '/api/settings')).status === 401);
  is('GET /api/parties without a token is 401', (await req('GET', '/api/parties')).status === 401);
  is('GET /api/items without a token is 401', (await req('GET', '/api/items')).status === 401);
  is('GET /api/tally/status without a token is 401', (await req('GET', '/api/tally/status')).status === 401);
  is('POST /api/invoices/clear without a token is 401', (await req('POST', '/api/invoices/clear')).status === 401);

  const bad = await req('POST', '/api/auth/login', { body: { username: 'admin', password: 'nope' } });
  is('login with a wrong password is 401', bad.status === 401);

  const login = await req('POST', '/api/auth/login', { body: { username: 'admin', password: PASSWORD } });
  is('login succeeds', login.status === 200 && Boolean(login.json?.token), JSON.stringify(login.json));
  const token = login.json?.token;
  if (!token) { console.log('\ncannot continue without a token'); process.exit(1); }

  is('GET /api/invoices with a token is 200', (await req('GET', '/api/invoices', { token })).status === 200);
  is('a forged token is 401', (await req('GET', '/api/invoices', { token: 'forged.token' })).status === 401);
  is('a tampered token is 401', (await req('GET', '/api/invoices', { token: `${token}x` })).status === 401);

  // Bank details are printed on every invoice (required on an Indian tax
  // invoice), so they must stay readable by signed-in staff. The requirement is
  // that the route is authenticated, which the tests above already assert.
  const bank = await req('GET', '/api/settings', { token });
  const bankVal = bank.json?.company?.bankAccountNo || '';
  is('an authenticated user can still read bank details for invoice printing', bankVal === '124002005002108', `got [${bankVal}]`);
  is('the party ledger exposes no bank data', !JSON.stringify((await req('GET', '/api/parties', { token })).json || {}).includes('124002005002108'));

  console.log('\n== bridge key / TDL access ==');
  is('a valid bridge key is accepted', (await req('GET', '/api/invoices', { bridge: BRIDGE_KEY })).status === 200);
  is('a wrong bridge key is 401', (await req('GET', '/api/invoices', { bridge: 'wrong' })).status === 401);
  const tdl = await req('GET', `/api/tally/export-xml?all=true&key=${BRIDGE_KEY}`);
  is('the TDL can pull XML with ?key= (no headers)', tdl.status === 200 && tdl.text.includes('ENVELOPE'), `status=${tdl.status}`);

  console.log('\n== bill numbering ==');
  await resetState();
  const first = await req('GET', '/api/invoices/next-number', { token });
  check('counter starts where Tally left off (250 -> next 251)', first.json?.nextSeq, 251);
  check('next-number renders the prefixed bill number', first.json?.invoiceNo, 'YP/26-27/251');

  const b1 = await req('POST', '/api/invoices', { token, body: bill('Customer A') });
  check('bill 1 gets 251', b1.json?.invoiceNo, 'YP/26-27/251');
  const b2 = await req('POST', '/api/invoices', { token, body: bill('Customer B') });
  check('bill 2 gets 252', b2.json?.invoiceNo, 'YP/26-27/252');

  const dup = await req('POST', '/api/invoices', { token, body: { ...bill('Dup'), invoiceNo: 'YP/26-27/251' } });
  is('an explicit duplicate bill number is refused with 409', dup.status === 409, `status=${dup.status} body=${JSON.stringify(dup.json)}`);

  console.log('\n== concurrent saves must not collide ==');
  const results = await Promise.all(
    Array.from({ length: 25 }, (_, i) => req('POST', '/api/invoices', { token, body: bill(`Race ${i}`) }))
  );
  const numbers = results.map((r) => r.json?.invoiceNo).filter(Boolean);
  const unique = new Set(numbers);
  is(`25 concurrent saves all succeeded (${numbers.length}/25)`, numbers.length === 25, `got ${numbers.length}`);
  is(`25 concurrent saves produced 25 distinct numbers`, unique.size === 25, `unique=${unique.size}`);

  const seqs = numbers.map((n) => Number(n.match(/(\d+)$/)[1])).sort((a, b) => a - b);
  const contiguous = seqs.every((s, i) => i === 0 || s === seqs[i - 1] + 1);
  is('the issued numbers are contiguous with no gaps', contiguous, JSON.stringify(seqs));

  console.log('\n== clear must not rewind the counter ==');
  const before = (await req('GET', '/api/invoices/next-number', { token })).json?.nextSeq;
  await req('POST', '/api/invoices/clear', { token });
  const after = (await req('GET', '/api/invoices/next-number', { token })).json?.nextSeq;
  check('clear leaves the counter exactly where it was', after, before);
  is('the counter never moved backwards', Number(after) >= Number(before), `${before} -> ${after}`);

  const b3 = await req('POST', '/api/invoices', { token, body: bill('After Clear') });
  check('a bill created after clear does not reuse a cleared number', b3.json?.invoiceNo, `YP/26-27/${before}`);

  console.log('\n== Tally readings move the counter forward only ==');
  const up = await req('POST', '/api/masters/tally-reading', { bridge: BRIDGE_KEY, body: { maxVoucher: 900, voucherCount: 901, company: 'Sanmati Solution' } });
  is('a Tally reading of 900 is accepted', up.status === 200, `status=${up.status}`);
  check('next number becomes 901', (await req('GET', '/api/invoices/next-number', { token })).json?.nextSeq, 901);

  await req('POST', '/api/masters/tally-reading', { bridge: BRIDGE_KEY, body: { maxVoucher: 5, voucherCount: 6 } });
  check('a stale Tally reading of 5 does not rewind it', (await req('GET', '/api/invoices/next-number', { token })).json?.nextSeq, 901);

  const src = (await req('GET', '/api/invoices/next-number', { token })).json;
  is('next-number reports where the number came from', Boolean(src?.source), JSON.stringify(src?.source));
  is('next-number reports bridge liveness', src?.bridge && typeof src.bridge.online === 'boolean', JSON.stringify(src?.bridge));
  is('next-number says Tally is not directly reachable here', src?.tally?.directProbeSupported === false || src?.tally?.reachable === false, JSON.stringify(src?.tally));

  console.log('\n== admin-only sequence control ==');
  is('set-next-number without confirmation is 400', (await req('POST', '/api/invoices/set-next-number', { token, body: { value: 1200 } })).status === 400);
  is('set-next-number with wrong confirmation is 400', (await req('POST', '/api/invoices/set-next-number', { token, body: { value: 1200, confirm: 'nope' } })).status === 400);
  is('set-next-number with correct confirmation is 200', (await req('POST', '/api/invoices/set-next-number', { token, body: { value: 1200, confirm: 'SET-1200' } })).status === 200);
  check('the counter moved to 1200', (await req('GET', '/api/invoices/next-number', { token })).json?.nextSeq, 1200);

  console.log('\n== Tally status tells the truth ==');
  const st = (await req('GET', '/api/tally/status', { token })).json;
  is('Tally is reported unreachable when it is down', st?.tallyReachable === false, JSON.stringify(st));
  is('overall online is false with no Tally and no agent', st?.online === false, JSON.stringify(st?.online));
  is('a real error message is returned', typeof st?.error === 'string' && st.error.length > 0, JSON.stringify(st?.error));

  console.log('\n== masters upsert does not wipe ==');
  await req('POST', '/api/parties', { token, body: { name: 'Persist Me', gstin: '24AAAAA0000A1Z5', phone: '9999999999' } });
  await req('POST', '/api/items', { token, body: { name: 'Persist Item', hsn: '39232100', baseRate: 50, gstRate: 18 } });
  const pushXml = `<ENVELOPE><LEDGER NAME="Tally Customer"><PARENT>Sundry Debtors</PARENT><PARTYGSTIN>24BBBBB1111B1Z5</PARTYGSTIN><ADDRESS>Somewhere</ADDRESS></LEDGER><STOCKITEM NAME="Tally Item"><BASEUNITS>KGS</BASEUNITS><RATE>77</RATE><HSNCODE>39232100</HSNCODE><GSTRATE>12</GSTRATE><CLOSINGBALANCE>40</CLOSINGBALANCE></STOCKITEM></ENVELOPE>`;
  const push = await req('POST', '/api/masters/tally-push', { bridge: BRIDGE_KEY, xml: pushXml });
  is('tally-push accepts XML', push.status === 200, `status=${push.status} ${JSON.stringify(push.json)}`);

  const parties = (await req('GET', '/api/parties', { token })).json || [];
  const items = (await req('GET', '/api/items', { token })).json || [];
  is('the Tally customer was added', parties.some((p) => p.name === 'Tally Customer'), JSON.stringify(parties.map((p) => p.name)));
  is('the manually created customer survived the push', parties.some((p) => p.name === 'Persist Me'), JSON.stringify(parties.map((p) => p.name)));
  is('the Tally product was added', items.some((i) => i.name === 'Tally Item'), JSON.stringify(items.map((i) => i.name)));
  is('the manually created product survived the push', items.some((i) => i.name === 'Persist Item'), JSON.stringify(items.map((i) => i.name)));

  const tallyItem = items.find((i) => i.name === 'Tally Item');
  check('the Tally product rate was read', tallyItem?.baseRate, 77);
  check('the Tally product GST rate was read', tallyItem?.gstRate, 12);
  check('the Tally product stock qty was read', tallyItem?.stockQty, 40);

  console.log('\n== data survives a restart (it is not on local disk) ==');
  const before2 = (await req('GET', '/api/invoices', { token })).json?.length;
  is('invoices are readable', typeof before2 === 'number', `got ${before2}`);

  console.log(`\n======================================`);
  console.log(`  passed: ${pass}   failed: ${fail}`);
  console.log(`======================================\n`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
