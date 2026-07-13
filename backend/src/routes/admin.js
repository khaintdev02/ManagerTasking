const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/role');
const { processNotifications } = require('../services/cronService');

const router = express.Router();
router.use(authMiddleware, adminMiddleware);

// GET /api/admin/users
router.get('/users', async (req, res) => {
  try {
    const users = await db.all('SELECT id, email, role, createdAt FROM users ORDER BY createdAt DESC');
    res.json(users);
  } catch (err) {
    console.error('Admin get users error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (id === req.user.id) {
    return res.status(400).json({ error: 'Không thể tự xóa tài khoản của chính mình.' });
  }
  const user = await db.get('SELECT id, email FROM users WHERE id = ?', [id]);
  if (!user) return res.status(404).json({ error: 'Không tìm thấy người dùng.' });

  // Ngăn chặn xóa admin cố định
  if (user.email === 'khainguyenthe203@gmail.com') {
    return res.status(400).json({ error: 'Không thể xóa tài khoản Admin cố định của hệ thống.' });
  }

  try {
    await db.run('DELETE FROM tasks WHERE userId = ?', [id]);
    await db.run('DELETE FROM users WHERE id = ?', [id]);
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Lỗi hệ thống, không thể xóa user.' });
  }
});

// PATCH /api/admin/users/:id/role
router.patch('/users/:id/role', async (req, res) => {
  try {
    const { role } = req.body;
    if (!['admin', 'user'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    const user = await db.get('SELECT id, email FROM users WHERE id = ?', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    await db.run("UPDATE users SET role = ?, updatedAt = datetime('now') WHERE id = ?", [role, req.params.id]);
    res.json({ id: user.id, email: user.email, role });
  } catch (err) {
    console.error('Admin update user role error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/tasks
router.get('/tasks', async (req, res) => {
  try {
    const tasks = await db.all(`
      SELECT t.*, u.email as userEmail
      FROM tasks t
      LEFT JOIN users u ON t.userId = u.id
      ORDER BY t.dueTime ASC
    `);

    const parsed = tasks.map(t => ({
      ...t,
      isDone: t.isDone === 1 || t.isDone === true,
      notifyTypes: JSON.parse(t.notifyTypes || '[]'),
      recipients: JSON.parse(t.recipients || '[]'),
      notificationHistory: JSON.parse(t.notificationHistory || '[]'),
      User: { id: t.userId, email: t.userEmail },
    }));

    res.json(parsed);
  } catch (err) {
    console.error('Admin get tasks error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  try {
    const totalUsersRes = await db.get('SELECT COUNT(*) as count FROM users');
    const totalTasksRes = await db.get('SELECT COUNT(*) as count FROM tasks');
    const doneTasksRes = await db.get('SELECT COUNT(*) as count FROM tasks WHERE isDone = 1');
    const overdueTasksRes = await db.get("SELECT COUNT(*) as count FROM tasks WHERE isDone = 0 AND dueTime < datetime('now')");

    res.json({
      totalUsers: parseInt(totalUsersRes.count),
      totalTasks: parseInt(totalTasksRes.count),
      doneTasks: parseInt(doneTasksRes.count),
      overdueTasks: parseInt(overdueTasksRes.count)
    });
  } catch (err) {
    console.error('Admin get stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/trigger-notify - Reset lastNotifiedAt and send notifications NOW (for testing)
router.post('/trigger-notify', async (req, res) => {
  try {
    await db.run('UPDATE tasks SET lastNotifiedAt = NULL WHERE isDone = 0');
    console.log('[Admin] Reset lastNotifiedAt for all pending tasks');

    // Run cron immediately
    await processNotifications();

    res.json({ message: 'Notification triggered successfully. Check server logs.' });
  } catch (err) {
    console.error('[Admin] Trigger notify error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/users - Admin creates a new user
router.post('/users', async (req, res) => {
  try {
    const { email, password, role } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const existing = await db.get('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userRole = role === 'admin' ? 'admin' : 'user';

    await db.run(
      'INSERT INTO users (email, password, role) VALUES (?, ?, ?)',
      [email, hashedPassword, userRole]
    );
    const userId = db.lastInsertRowid();
    const user = await db.get('SELECT id, email, role, createdAt FROM users WHERE id = ?', [userId]);

    res.status(201).json(user);
  } catch (err) {
    console.error('[Admin] Create user error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/users/:id - Admin updates a user's details (email, password, role)
router.put('/users/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { email, password, role } = req.body;

    const user = await db.get('SELECT id FROM users WHERE id = ?', [id]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (email) {
      const existing = await db.get('SELECT id FROM users WHERE email = ? AND id != ?', [email, id]);
      if (existing) return res.status(409).json({ error: 'Email already in use' });
    }

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      await db.run(
        `UPDATE users SET
          email = COALESCE(?, email),
          password = ?,
          role = COALESCE(?, role),
          updatedAt = datetime('now')
         WHERE id = ?`,
        [email, hashedPassword, role, id]
      );
    } else {
      await db.run(
        `UPDATE users SET
          email = COALESCE(?, email),
          role = COALESCE(?, role),
          updatedAt = datetime('now')
         WHERE id = ?`,
        [email, role, id]
      );
    }

    const updated = await db.get('SELECT id, email, role, createdAt FROM users WHERE id = ?', [id]);
    res.json(updated);
  } catch (err) {
    console.error('[Admin] Update user error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
