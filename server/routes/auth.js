import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AUTH_FILE = path.join(__dirname, '..', 'data', 'auth.json');

const router = express.Router();

async function readAuth() {
  try {
    const raw = await fs.readFile(AUTH_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {
      username: 'admin',
      password: 'admin',
      name: 'Yamuna Admin',
      role: 'Super Admin',
      email: 'admin@yamunaplastics.com',
      updatedAt: new Date().toISOString()
    };
  }
}

async function writeAuth(data) {
  await fs.writeFile(AUTH_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// 1. Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password are required' });
    }

    const auth = await readAuth();
    if (
      username.trim().toLowerCase() === auth.username.toLowerCase() &&
      password === auth.password
    ) {
      const token = Buffer.from(`${auth.username}:${Date.now()}:${Math.random().toString(36)}`).toString('base64');
      return res.json({
        success: true,
        token,
        user: {
          username: auth.username,
          name: auth.name || 'Yamuna Admin',
          role: auth.role || 'Super Admin',
          email: auth.email || 'admin@yamunaplastics.com'
        }
      });
    }

    return res.status(401).json({ success: false, error: 'Invalid ID or Password' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Profile
router.get('/profile', async (req, res) => {
  try {
    const auth = await readAuth();
    res.json({
      username: auth.username,
      name: auth.name,
      role: auth.role,
      email: auth.email,
      lastUpdated: auth.updatedAt
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Change Password
router.post('/change-password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'Current password and new password are required' });
    }

    if (newPassword.trim().length < 3) {
      return res.status(400).json({ success: false, error: 'New password must be at least 3 characters long' });
    }

    const auth = await readAuth();

    if (currentPassword !== auth.password) {
      return res.status(400).json({ success: false, error: 'Current password does not match' });
    }

    auth.password = newPassword.trim();
    auth.updatedAt = new Date().toISOString();
    await writeAuth(auth);

    res.json({
      success: true,
      message: 'Password updated successfully! Please use your new password next time you log in.'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
