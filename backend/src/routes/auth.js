const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const existing = await db.get('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userRole = 'user';

    await db.run(
      'INSERT INTO users (email, password, role) VALUES (?, ?, ?)',
      [email, hashedPassword, userRole]
    );
    const userId = db.lastInsertRowid();
    const user = await db.get('SELECT id, email, role, createdAt FROM users WHERE id = ?', [userId]);

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({ token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/me
router.get('/me', require('../middleware/auth'), async (req, res) => {
  try {
    const user = await db.get('SELECT id, email, role FROM users WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/auth/profile - Update own profile
router.put('/profile', require('../middleware/auth'), async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    // Check if email already exists for another user
    const existing = await db.get('SELECT id FROM users WHERE email = ? AND id != ?', [email, req.user.id]);
    if (existing) return res.status(409).json({ error: 'Email already in use' });

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      await db.run("UPDATE users SET email = ?, password = ?, updatedAt = datetime('now') WHERE id = ?", [email, hashedPassword, req.user.id]);
    } else {
      await db.run("UPDATE users SET email = ?, updatedAt = datetime('now') WHERE id = ?", [email, req.user.id]);
    }

    const user = await db.get('SELECT id, email, role FROM users WHERE id = ?', [req.user.id]);
    res.json(user);
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/auth/profile - Delete own account
router.delete('/profile', require('../middleware/auth'), async (req, res) => {
  try {
    // Delete all tasks associated with this user
    await db.run('DELETE FROM tasks WHERE userId = ?', [req.user.id]);
    // Delete user
    await db.run('DELETE FROM users WHERE id = ?', [req.user.id]);
    res.json({ message: 'Account deleted successfully' });
  } catch (err) {
    console.error('Delete profile error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
