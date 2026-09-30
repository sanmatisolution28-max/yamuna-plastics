/**
 * Reset a user's password from the command line.
 *
 * Needed because ADMIN_PASSWORD only seeds an account on first boot. Once a
 * user exists, changing the env var does nothing, and the only other route is
 * the change-password endpoint, which needs a login you no longer have.
 *
 *   MONGODB_URI=... node scripts/reset-password.js <username> <new-password>
 *
 * Reads the password from ADMIN_PASSWORD when the argument is omitted, so it
 * never has to appear in shell history.
 */

import { initDb, upsertUser, getUser, listUsers, closeDb } from '../lib/db.js';
import { hashPassword } from '../lib/auth.js';

const [username, passwordArg] = process.argv.slice(2);
const password = passwordArg || process.env.ADMIN_PASSWORD;

if (!username) {
  const known = await listUsers().catch(() => []);
  console.error('Usage: node scripts/reset-password.js <username> [new-password]');
  if (known.length) {
    console.error('\nExisting users:');
    for (const u of known) console.error(`  ${u._id}  (${u.role})`);
  }
  process.exit(1);
}

if (!password) {
  console.error('No password given. Pass it as an argument or set ADMIN_PASSWORD.');
  process.exit(1);
}

if (String(password).length < 8) {
  console.error('Password must be at least 8 characters.');
  process.exit(1);
}

await initDb();

const existing = await getUser(username);
if (!existing) {
  console.error(`No user named "${username}".`);
  const known = await listUsers();
  console.error('\nExisting users:');
  for (const u of known) console.error(`  ${u._id}  (${u.role})`);
  await closeDb();
  process.exit(1);
}

// Keep the existing profile; only the credential changes.
const { salt, hash } = hashPassword(password);
await upsertUser({
  username,
  salt,
  hash,
  name: existing.name,
  role: existing.role,
  email: existing.email
});

console.log(`Password updated for "${username}".`);
console.log('Existing sessions stay valid until they expire; sign in again to be safe.');

await closeDb();
