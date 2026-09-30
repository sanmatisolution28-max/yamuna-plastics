/**
 * Database layer for Yamuna Plastics (MongoDB).
 *
 * Storage survives Render deploys because it lives in the Atlas cluster, not on
 * the app's ephemeral disk.
 *
 * Bill numbering is the load-bearing part. Two mechanisms, in order:
 *   1. A ticket is claimed with a single atomic findOneAndUpdate + $inc, so two
 *      concurrent saves can never receive the same number.
 *   2. A unique index on invoiceNo is the hard backstop, mirroring Tally's own
 *      (VOUCHERTYPE-ON, VOUCHERNUMBER) uniqueness rule.
 *
 * The counter only ever moves forward: $inc for allocation, $max for alignment
 * with Tally. A stale or wrong reading from Tally cannot rewind it into numbers
 * Tally has already used.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');

const COLLECTIONS = ['invoices', 'parties', 'items', 'settings', 'invoice_seq', 'bridge_state', 'users'];

let client = null;
let db = null;
let initPromise = null;
let memoryFallback = false;

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

function readJsonFile(file, fallback) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    return JSON.parse(raw) ?? fallback;
  } catch {
    return fallback;
  }
}

function requireUri() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    throw new Error(
      'MONGODB_URI is not set. Add your Atlas connection string as the MONGODB_URI environment variable on Render.'
    );
  }
  // Surface a placeholder password early - the Atlas console copies the string
  // with <db_password> still in it often enough to be worth catching.
  if (uri.includes('<db_password>') || uri.includes('db_password>')) {
    throw new Error('MONGODB_URI still contains the <db_password> placeholder. Paste the real password into the connection string.');
  }
  return uri;
}

async function connect() {
  const uri = requireUri();
  const { MongoClient } = await import('mongodb');

  client = new MongoClient(uri, {
    serverSelectionTimeoutMS: Number(process.env.MONGO_TIMEOUT_MS || 15000),
    retryWrites: true,
    maxPoolSize: Number(process.env.MONGO_POOL_MAX || 10)
  });

  await client.connect();
  const name = process.env.MONGO_DB_NAME || new URL(uri).pathname.replace(/^\//, '') || 'yamuna';
  db = client.db(name);
  await db.command({ ping: 1 });
  return name;
}

async function ensureIndexes() {
  await db.collection('invoices').createIndex({ invoiceNo: 1 }, { unique: true, name: 'ux_invoice_no' });
  await db.collection('invoices').createIndex({ seq: -1 }, { name: 'ix_seq' });
  await db.collection('invoices').createIndex({ date: -1 }, { name: 'ix_date' });
  await db.collection('invoices').createIndex({ synced: 1 }, { name: 'ix_synced' });
  await db.collection('parties').createIndex({ nameKey: 1 }, { unique: true, name: 'ux_party_name' });
  await db.collection('items').createIndex({ nameKey: 1 }, { unique: true, name: 'ux_item_name' });
}

async function seedFromLegacyJson() {
  const now = new Date().toISOString();
  const log = (msg) => console.log(`[db] ${msg}`);

  const parties = db.collection('parties');
  if ((await parties.estimatedDocumentCount()) === 0) {
    const legacy = readJsonFile(path.join(DATA_DIR, 'parties.json'), []);
    if (Array.isArray(legacy) && legacy.length) {
      await parties.insertMany(
        legacy.map((p) => toPartyDoc(p)),
        { ordered: false }
      ).catch(() => {});
      log(`seeded ${legacy.length} parties from legacy parties.json`);
    }
  }

  const items = db.collection('items');
  if ((await items.estimatedDocumentCount()) === 0) {
    const legacy = readJsonFile(path.join(DATA_DIR, 'items.json'), []);
    if (Array.isArray(legacy) && legacy.length) {
      await items
        .insertMany(
          legacy.map((i) => toItemDoc(i)),
          { ordered: false }
        )
        .catch(() => {});
      log(`seeded ${legacy.length} items from legacy items.json`);
    }
  }

  const invoices = db.collection('invoices');
  if ((await invoices.estimatedDocumentCount()) === 0) {
    const legacy = readJsonFile(path.join(DATA_DIR, 'invoices.json'), []);
    if (Array.isArray(legacy) && legacy.length) {
      await invoices
        .insertMany(
          legacy.map((i) => toInvoiceDoc(i)),
          { ordered: false }
        )
        .catch(() => {});
      log(`seeded ${legacy.length} invoices from legacy invoices.json`);
    }
  }

  const settings = db.collection('settings');
  if ((await settings.countDocuments({ _id: 'app' })) === 0) {
    const legacy = readJsonFile(path.join(DATA_DIR, 'settings.json'), null);
    await settings.insertOne({ _id: 'app', ...SEED_SETTINGS, ...(legacy || {}), updatedAt: now });
    log('seeded settings');
  }

  const seq = db.collection('invoice_seq');
  if ((await seq.countDocuments({ _id: 'app' })) === 0) {
    const legacy = readJsonFile(path.join(DATA_DIR, 'settings.json'), {});
    const legacyNext = Number(legacy?.nextInvoiceNumber) || SEED_SETTINGS.nextInvoiceNumber;
    await seq.insertOne({ _id: 'app', nextValue: legacyNext, updatedAt: now, updatedBy: 'seed' });
    log(`seeded invoice counter at ${legacyNext}`);
  }

  const bridge = db.collection('bridge_state');
  if ((await bridge.countDocuments({ _id: 'app' })) === 0) {
    await bridge.insertOne({
      _id: 'app',
      lastHeartbeat: null,
      lastSyncAt: null,
      lastResult: null,
      tallyMaxVoucher: 0,
      tallyCompany: ''
    });
  }
}

export async function initDb() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      const name = await connect();
      await ensureIndexes();
      await seedFromLegacyJson();
      console.log(`[db] connected to MongoDB database "${name}"`);
    } catch (err) {
      // Never fall back silently: a silent in-memory store would look like
      // working software while losing every bill.
      console.error('[db] FATAL: ' + err.message);
      throw err;
    }
  })();
  return initPromise;
}

export function getDriver() {
  return memoryFallback ? 'mongo-memory' : 'mongodb';
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

const SEED_SETTINGS = {
  company: {
    name: 'YAMUNA PLASTIC',
    shortName: 'Yamuna Plastic',
    tagline: 'Manufacturers & Suppliers of Premium Plastic Packaging & Components',
    address: '26, Patel Estate, Opp Sahajanand Avenue, Opp Muktidham Estate, Jivanwadi, Nikol Gam Road',
    city: 'Ahmedabad',
    state: 'Gujarat',
    stateCode: '24',
    pincode: '382350',
    phone: '+91 9426082500',
    email: 'yamunaplastic@yahoo.com',
    gstin: '24AKNPP7596H1ZF',
    pan: 'AKNPP7596H',
    udyam: 'UDYAM-GJ-01-0051476 (Small)',
    bankName: 'The Karnavati Co-Op.Bank Ltd.',
    bankBranch: 'Bapunagar',
    bankAccountNo: '124002005002108',
    bankIfsc: 'GSCB0UTKCBL'
  },
  tally: {
    host: 'localhost',
    port: 9000,
    companyName: 'Sanmati Solution',
    voucherType: 'Sales',
    salesLedgerIntra: 'Sales - Plastic Goods (18%)',
    salesLedgerInter: 'Interstate Sales - Plastic Goods (18%)',
    cgstLedger: 'Output CGST 9%',
    sgstLedger: 'Output SGST 9%',
    igstLedger: 'Output IGST 18%',
    roundOffLedger: 'Round Off',
    freightLedger: 'Freight & Delivery Charges'
  },
  ewayBill: {
    enabled: true,
    mode: 'auto',
    gstin: '24AKNPP7596H1ZF',
    gspProvider: 'NIC Direct Portal / Tally GSP',
    autoSyncWithTally: true,
    defaultDispatchPincode: '382350',
    thresholdAmount: 50000,
    alwaysGenerate: true
  },
  invoicePrefix: 'YP/26-27/',
  // Only a starting point for the invoice_seq counter. getSettings/saveSettings
  // treat nextInvoiceNumber as derived and never persist it.
  nextInvoiceNumber: 1
};

export function defaultSettings() {
  return JSON.parse(JSON.stringify(SEED_SETTINGS));
}

/**
 * The invoice counter lives in the invoice_seq collection and nowhere else.
 * nextInvoiceNumber is mirrored here purely so the older settings payload,
 * which the client still reads, reports the same number that will actually be
 * issued. It used to be an independent field that nothing but a manual settings
 * save ever wrote, so it sat at 252 while the real counter had moved to 1200
 * and the UI advertised a bill number the server would never hand out.
 */
function stripCounter(obj) {
  const { nextInvoiceNumber, ...rest } = obj || {};
  return rest;
}

export async function getSettings() {
  const doc = await db.collection('settings').findOne({ _id: 'app' });
  const base = doc ? stripCounter(doc) : defaultSettings();
  const { _id, updatedAt, nextInvoiceNumber, ...clean } = base;
  return { ...clean, nextInvoiceNumber: (await getSeqState()).nextValue };
}

export async function saveSettings(obj) {
  const now = new Date().toISOString();
  const body = stripCounter(obj);
  await db.collection('settings').updateOne(
    { _id: 'app' },
    { $set: { ...body, updatedAt: now } },
    { upsert: true }
  );
  const { _id, updatedAt, nextInvoiceNumber, ...clean } = body;
  return { ...clean, nextInvoiceNumber: (await getSeqState()).nextValue };
}

// ---------------------------------------------------------------------------
// Parties / Items
// ---------------------------------------------------------------------------

const nameKey = (name) => String(name || '').trim().toLowerCase();

function toPartyDoc(p) {
  const { id, name, ...rest } = p || {};
  return { _id: id, name: String(name || '').trim(), nameKey: nameKey(name), ...rest, updatedAt: new Date().toISOString() };
}

function toItemDoc(i) {
  const { id, name, ...rest } = i || {};
  return { _id: id, name: String(name || '').trim(), nameKey: nameKey(name), ...rest, updatedAt: new Date().toISOString() };
}

function fromDoc(doc) {
  const { _id, nameKey: _nk, updatedAt: _ua, ...rest } = doc;
  return { id: _id, ...rest };
}

export async function getParties() {
  return (await db.collection('parties').find({}).sort({ nameKey: 1 }).toArray()).map(fromDoc);
}

export async function saveParties(list) {
  const col = db.collection('parties');
  const seen = new Set();
  for (const p of list) {
    const name = String(p?.name || '').trim();
    if (!name) continue;
    const doc = toPartyDoc(p);
    seen.add(doc.nameKey);
    await col.replaceOne({ nameKey: doc.nameKey }, doc, { upsert: true });
  }
  const stale = await col.find({ nameKey: { $nin: [...seen] } }, { projection: { nameKey: 1 } }).toArray();
  if (stale.length) await col.deleteMany({ _id: { $in: stale.map((s) => s._id) } });
}

export async function getItems() {
  return (await db.collection('items').find({}).sort({ nameKey: 1 }).toArray()).map(fromDoc);
}

export async function saveItems(list) {
  const col = db.collection('items');
  const seen = new Set();
  for (const i of list) {
    const name = String(i?.name || '').trim();
    if (!name) continue;
    const doc = toItemDoc(i);
    seen.add(doc.nameKey);
    await col.replaceOne({ nameKey: doc.nameKey }, doc, { upsert: true });
  }
  const stale = await col.find({ nameKey: { $nin: [...seen] } }, { projection: { nameKey: 1 } }).toArray();
  if (stale.length) await col.deleteMany({ _id: { $in: stale.map((s) => s._id) } });
}

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

export function extractSeq(invoiceNo) {
  if (!invoiceNo) return null;
  const m = String(invoiceNo).match(/(\d+)$/);
  return m ? parseInt(m[1], 10) : null;
}

function toInvoiceDoc(inv) {
  const now = new Date().toISOString();
  return {
    _id: inv.id,
    invoiceNo: inv.invoiceNo,
    seq: extractSeq(inv.invoiceNo) ?? 0,
    date: inv.date || now.slice(0, 10),
    partyName: inv.partyName || '',
    grandTotal: Number(inv.grandTotal || 0),
    synced: inv.tallySync?.synced ? 1 : 0,
    ...inv,
    createdAt: inv.createdAt || now,
    updatedAt: now
  };
}

function fromInvoiceDoc(doc) {
  const { _id, nameKey: _nk, seq: _seq, synced: _synced, updatedAt: _ua, ...rest } = doc;
  return { ...rest, id: _id };
}

export async function getInvoices() {
  return (await db.collection('invoices').find({}).sort({ date: -1, seq: -1 }).toArray()).map(fromInvoiceDoc);
}

export async function getInvoice(id) {
  const doc = await db.collection('invoices').findOne({
    $or: [{ _id: id }, { invoiceNo: id }]
  });
  return doc ? fromInvoiceDoc(doc) : null;
}

export async function invoiceExists(invoiceNo) {
  return Boolean(await db.collection('invoices').findOne({ invoiceNo }, { projection: { _id: 1 } }));
}

export async function maxInvoiceSeq() {
  const top = await db.collection('invoices').find({}, { projection: { seq: 1 }, sort: { seq: -1 }, limit: 1 }).toArray();
  return Number(top[0]?.seq || 0);
}

function isDuplicateKey(err) {
  return err?.code === 11000 || /E11000|duplicate key/i.test(err?.message || '');
}

export async function insertInvoiceTx(tx, inv) {
  try {
    await db.collection('invoices').insertOne(toInvoiceDoc(inv));
  } catch (err) {
    if (isDuplicateKey(err)) {
      const e = new Error(`Bill number ${inv.invoiceNo} is already used`);
      e.code = 'DUPLICATE_INVOICE_NO';
      throw e;
    }
    throw err;
  }
}

export async function updateInvoice(inv) {
  const doc = toInvoiceDoc(inv);
  delete doc._id;
  try {
    await db.collection('invoices').updateOne({ _id: inv.id }, { $set: doc });
  } catch (err) {
    if (isDuplicateKey(err)) {
      const e = new Error(`Bill number ${inv.invoiceNo} is already used`);
      e.code = 'DUPLICATE_INVOICE_NO';
      throw e;
    }
    throw err;
  }
  return inv;
}

export async function deleteInvoice(id) {
  const inv = await getInvoice(id);
  if (!inv) return null;
  await db.collection('invoices').deleteOne({ _id: id });
  return inv;
}

/** Delete every invoice. Deliberately does not touch the counter. */
export async function clearInvoices() {
  await db.collection('invoices').deleteMany({});
}

// ---------------------------------------------------------------------------
// Sequence
// ---------------------------------------------------------------------------

const seqCol = () => db.collection('invoice_seq');

export async function getSeqState() {
  const doc = await seqCol().findOne({ _id: 'app' });
  return {
    nextValue: Number(doc?.nextValue || 1),
    updatedAt: doc?.updatedAt || null,
    updatedBy: doc?.updatedBy || ''
  };
}

/** Claim a unique ticket with one atomic $inc. Returns the pre-increment value. */
async function claimTicket() {
  const doc = await seqCol().findOneAndUpdate(
    { _id: 'app' },
    { $inc: { nextValue: 1 }, $set: { updatedAt: new Date().toISOString(), updatedBy: 'allocate' } },
    { returnDocument: 'before' }
  );
  return doc ? Number(doc.nextValue) : 1;
}

/**
 * Hand out the next bill number.
 *
 * A ticket is claimed atomically, so two people saving at the same moment get
 * different numbers. The floor is lifted to max(counter, highest local seq + 1)
 * first so the counter can never sit below what is already used.
 */
export async function withSeqLock(fn) {
  const highest = await maxInvoiceSeq();
  const floor = Math.max(1, highest + 1);

  // Ensure the counter document exists before filtering on it. Doing this as a
  // separate upsert matters: combining $lt with upsert would try to insert a
  // second _id:'app' document whenever the filter matches nothing.
  await seqCol().updateOne(
    { _id: 'app' },
    { $setOnInsert: { nextValue: 1, updatedAt: new Date().toISOString(), updatedBy: 'bootstrap' } },
    { upsert: true }
  );

  // Lift the floor so the counter can never sit below a number already used.
  await seqCol().updateOne(
    { _id: 'app', nextValue: { $lt: floor } },
    { $set: { nextValue: floor, updatedAt: new Date().toISOString(), updatedBy: 'floor' } }
  );

  const ticket = await claimTicket();
  const now = new Date().toISOString();

  const allocator = {
    current: ticket,
    maxExisting: highest,
    isTaken: async (invoiceNo) => invoiceExists(invoiceNo),
    // Only ever moves forward.
    bumpTo: async (value) => {
      const n = Number(value);
      if (Number.isFinite(n) && n > ticket) {
        await seqCol().updateOne(
          { _id: 'app' },
          { $max: { nextValue: n }, $set: { updatedAt: now, updatedBy: 'allocate' } }
        );
        return n;
      }
      return ticket;
    },
    persist: async () => ticket
  };

  // Mirrors the SQL signature so routes do not care which driver is in use.
  return fn(allocator, { exec: async () => {} });
}

/**
 * Raise the counter to at least `value`. Used when Tally reports a higher
 * voucher number. Uses $max, so it can never rewind the counter.
 */
export async function raiseSeqTo(value, by = 'tally-report') {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return getSeqState();
  const highest = await maxInvoiceSeq();
  const now = new Date().toISOString();
  await seqCol().updateOne(
    { _id: 'app' },
    { $max: { nextValue: n }, $set: { updatedAt: now, updatedBy: by } },
    { upsert: true }
  );
  const state = await getSeqState();
  return { ...state, nextValue: Math.max(state.nextValue, highest + 1) };
}

// ---------------------------------------------------------------------------
// Bridge state
// ---------------------------------------------------------------------------

const bridgeCol = () => db.collection('bridge_state');

export async function getBridgeState() {
  const doc = await bridgeCol().findOne({ _id: 'app' });
  if (!doc) return null;
  return {
    lastHeartbeat: doc.lastHeartbeat || null,
    lastSyncAt: doc.lastSyncAt || null,
    lastResult: doc.lastResult || null,
    tallyMaxVoucher: Number(doc.tallyMaxVoucher || 0),
    tallyCompany: doc.tallyCompany || ''
  };
}

export async function ensureBridgeState() {
  await bridgeCol().updateOne(
    { _id: 'app' },
    { $setOnInsert: { lastHeartbeat: null, lastSyncAt: null, lastResult: null, tallyMaxVoucher: 0, tallyCompany: '' } },
    { upsert: true }
  );
}

export async function recordHeartbeat() {
  await ensureBridgeState();
  await bridgeCol().updateOne({ _id: 'app' }, { $set: { lastHeartbeat: new Date().toISOString() } });
}

export async function recordSyncResult(result, tallyMaxVoucher, tallyCompany) {
  await ensureBridgeState();
  const set = { lastSyncAt: new Date().toISOString(), lastResult: result };
  if (Number(tallyMaxVoucher || 0) > 0) set.tallyMaxVoucher = Number(tallyMaxVoucher);
  if (tallyCompany) set.tallyCompany = String(tallyCompany);
  await bridgeCol().updateOne({ _id: 'app' }, { $set: set });
}

export async function recordTallyReading(maxVoucher, company) {
  await ensureBridgeState();
  const set = { tallyMaxVoucher: Number(maxVoucher || 0) };
  if (company) set.tallyCompany = String(company);
  await bridgeCol().updateOne({ _id: 'app' }, { $set: set });
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

const usersCol = () => db.collection('users');

export async function getUser(username) {
  return usersCol().findOne({ _id: username });
}

export async function listUsers() {
  return usersCol().find({}, { projection: { _id: 1, name: 1, role: 1, email: 1, updatedAt: 1 } }).toArray();
}

export async function upsertUser(user) {
  const now = new Date().toISOString();
  await usersCol().updateOne(
    { _id: user.username },
    {
      $set: {
        salt: user.salt,
        hash: user.hash,
        name: user.name || '',
        role: user.role || 'Staff',
        email: user.email || '',
        updatedAt: now
      }
    },
    { upsert: true }
  );
  return user;
}

export async function deleteUser(username) {
  await usersCol().deleteOne({ _id: username });
}

export async function closeDb() {
  if (client) await client.close();
}
