import express from 'express';
import {
  getUser,
  deleteUser,
  upsertUser,
  listUsers,
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  ensureSeedUser,
  requireAdmin
} from '../lib/auth.js';

const router = express.Router();

const publicUser = (u) => ({
  username: u.username,
  name: u.name,
  role: u.role,
  email: u.email,
  lastUpdated: u.updated_at || u.updatedAt
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password are required' });
    }

    const user = await getUser(String(username).trim());
    // Same message either way so the endpoint does not confirm which usernames exist.
    const ok = user && verifyPassword(password, user.salt, user.hash);
    if (!ok) {
      return res.status(401).json({ success: false, error: 'Invalid ID or Password' });
    }

    return res.json({
      success: true,
      token: signToken(user),
      user: publicUser(user)
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/profile', async (req, res) => {
  try {
    const username = req.user?.sub;
    if (!username || username === 'bridge') {
      return res.status(403).json({ error: 'No user profile for this caller' });
    }
    const user = await getUser(username);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(publicUser(user));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/change-password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'Current password and new password are required' });
    }
    if (String(newPassword).length < 8) {
      return res.status(400).json({ success: false, error: 'New password must be at least 8 characters long' });
    }

    const username = req.user?.sub;
    if (!username || username === 'bridge') {
      return res.status(403).json({ success: false, error: 'Cannot change password for this caller' });
    }

    const user = await getUser(username);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    if (!verifyPassword(currentPassword, user.salt, user.hash)) {
      return res.status(400).json({ success: false, error: 'Current password does not match' });
    }

    const { salt, hash } = hashPassword(String(newPassword));
    await upsertUser({ ...user, salt, hash });

    res.json({
      success: true,
      message: 'Password updated successfully. Please use your new password next time you log in.'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin-only user management
router.get('/users', requireAdmin, async (req, res) => {
  try {
    res.json(await listUsers());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/users', requireAdmin, async (req, res) => {
  try {
    const { username, password, name, role, email } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password are required' });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters long' });
    }
    const uname = String(username).trim();
    const existing = await getUser(uname);
    if (existing) {
      return res.status(409).json({ success: false, error: 'That username already exists' });
    }
    const { salt, hash } = hashPassword(String(password));
    await upsertUser({ username: uname, salt, hash, name, role, email });
    res.status(201).json({ success: true, username: uname });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/users/:username', requireAdmin, async (req, res) => {
  try {
    const { username } = req.params;
    if (username === req.user.sub) {
      return res.status(400).json({ success: false, error: 'You cannot delete your own account' });
    }
    const user = await getUser(username);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    await deleteUser(username);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/status', async (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  const payload = verifyToken(token);
  res.json({ authenticated: Boolean(payload) });
});

// Keep the seed available for the server bootstrap without a circular import.
export { ensureSeedUser };
export default router;
