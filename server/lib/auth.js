/**
 * Authentication for Yamuna Plastics.
 *
 * Three ways to authenticate, because three different clients need to talk to
 * the API:
 *   1. Browser / React app  ->  Authorization: Bearer <session token>
 *   2. Bridge agent + .bat  ->  X-Bridge-Key: <BRIDGE_KEY>
 *   3. Tally TDL            ->  ?key=<BRIDGE_KEY>   (Tally cannot send headers)
 */

import crypto from 'crypto';
import {
  getUser,
  upsertUser,
  deleteUser,
  listUsers,
  initDb
} from './db.js';

// ---------------------------------------------------------------------------
// Password hashing
// ---------------------------------------------------------------------------

const SCRYPT_KEYLEN = 64;

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, SCRYPT_KEYLEN).toString('hex');
  return { salt, hash };
}

export function verifyPassword(password, salt, expectedHash) {
  if (!salt || !expectedHash) return false;
  const candidate = crypto.scryptSync(String(password), salt, SCRYPT_KEYLEN);
  const expected = Buffer.from(expectedHash, 'hex');
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}

// ---------------------------------------------------------------------------
// Session tokens
// ---------------------------------------------------------------------------

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production' || process.env.RENDER) {
    throw new Error(
      'SESSION_SECRET is not set. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"'
    );
  }
  if (!globalThis.__yamunaDevSecret) {
    globalThis.__yamunaDevSecret = crypto.randomBytes(48).toString('base64url');
    console.warn('[auth] SESSION_SECRET not set - using a random dev secret. Sessions reset on restart.');
  }
  return globalThis.__yamunaDevSecret;
}

const b64url = (buf) => Buffer.from(buf).toString('base64url');
const TOKEN_TTL_MS = Number(process.env.SESSION_TTL_HOURS || 12) * 3600 * 1000;

export function signToken(user) {
  const payload = {
    sub: user.username,
    name: user.name || user.username,
    role: user.role || 'Staff',
    iat: Date.now(),
    exp: Date.now() + TOKEN_TTL_MS
  };
  const body = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', getSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;

  const expected = crypto.createHmac('sha256', getSecret()).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!payload?.exp || payload.exp < Date.now()) return null;
  return payload;
}

// ---------------------------------------------------------------------------
// Bridge key
// ---------------------------------------------------------------------------

export function getBridgeKey() {
  return process.env.BRIDGE_KEY || null;
}

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function checkBridgeKey(candidate) {
  const key = getBridgeKey();
  if (!key || !candidate) return false;
  return safeEqual(key, candidate);
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export const PUBLIC_PATHS = new Set(['/api/health', '/api/auth/login', '/api/auth/status']);

function extractToken(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return null;
}

/**
 * Gate every API route. Allows a valid session token or the shared bridge key.
 * Attaches `req.user` ({ sub, role, via }).
 */
export function requireAuth(req, res, next) {
  if (PUBLIC_PATHS.has(req.path) || PUBLIC_PATHS.has(req.originalUrl)) return next();

  const key = req.headers['x-bridge-key'] || req.query?.key;
  if (checkBridgeKey(key)) {
    req.user = { sub: 'bridge', role: 'bridge', via: 'bridge-key' };
    return next();
  }

  const payload = verifyToken(extractToken(req));
  if (payload) {
    req.user = { sub: payload.sub, role: payload.role, name: payload.name, via: 'session' };
    return next();
  }

  res.status(401).json({ error: 'Authentication required' });
}

/** Narrow a rule down to admins and the bridge agent. */
export function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  if (req.user.via === 'bridge-key') return next();
  if (req.user.role !== 'Super Admin') {
    return res.status(403).json({ error: 'Super Admin role required' });
  }
  next();
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

/**
 * Make sure at least one usable login exists. Uses ADMIN_USERNAME /
 * ADMIN_PASSWORD on first boot; changing them later does not clobber an
 * existing account, so use the change-password endpoint instead.
 */
export async function ensureSeedUser() {
  await initDb();
  const existing = await listUsers();
  if (existing.length > 0) return { created: false, users: existing.length };

  const username = (process.env.ADMIN_USERNAME || 'admin').trim();
  const password = process.env.ADMIN_PASSWORD || 'admin';
  const { salt, hash } = hashPassword(password);

  await upsertUser({
    username,
    salt,
    hash,
    name: process.env.ADMIN_NAME || 'Yamuna Admin',
    role: 'Super Admin',
    email: process.env.ADMIN_EMAIL || 'admin@yamunaplastics.com'
  });

  if (!process.env.ADMIN_PASSWORD) {
    console.warn(
      '[auth] Seeded default admin/admin. Set ADMIN_PASSWORD and change it from Profile after first login.'
    );
  }
  return { created: true, users: 1 };
}

export { getUser, listUsers, upsertUser, deleteUser };
