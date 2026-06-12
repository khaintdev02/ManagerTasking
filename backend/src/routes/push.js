const express = require('express');
const db = require('../config/db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// POST /api/push/subscribe
router.post('/subscribe', async (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription) {
      return res.status(400).json({ error: 'Subscription required' });
    }

    const user = await db.get('SELECT id FROM users WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    await db.run("UPDATE users SET pushSubscription = ?, updatedAt = datetime('now') WHERE id = ?", [
      JSON.stringify(subscription),
      req.user.id,
    ]);

    res.json({ message: 'Push subscription saved' });
  } catch (err) {
    console.error('Subscribe error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/push/unsubscribe
router.delete('/unsubscribe', async (req, res) => {
  try {
    await db.run("UPDATE users SET pushSubscription = NULL, updatedAt = datetime('now') WHERE id = ?", [req.user.id]);
    res.json({ message: 'Push subscription removed' });
  } catch (err) {
    console.error('Unsubscribe error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/push/vapid-public-key
router.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || null });
});

module.exports = router;
