const express = require('express');
const db = require('../config/db');

const router = express.Router();
router.use(authMiddleware);

function authMiddleware(req, res, next) {
  // Pass auth
  require('../middleware/auth')(req, res, next);
}

function parseTask(task) {
  if (!task) return null;
  return {
    ...task,
    isDone: task.isDone === 1 || task.isDone === true,
    notifyTypes: JSON.parse(task.notifyTypes || '[]'),
    recipients: JSON.parse(task.recipients || '[]'),
    notifyCycle: task.notifyCycle || 'none',
  };
}

// GET /api/tasks
router.get('/', async (req, res) => {
  try {
    const { status, search } = req.query;
    const userId = req.user.id;

    let sql = 'SELECT * FROM tasks WHERE userId = ?';
    const params = [userId];

    if (status === 'done') {
      sql += ' AND isDone = 1';
    } else if (status === 'pending') {
      sql += ' AND isDone = 0';
    } else if (status === 'overdue') {
      sql += " AND isDone = 0 AND dueTime < datetime('now')";
    }

    if (search) {
      sql += ' AND (title LIKE ? OR description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY dueTime ASC';

    const rawTasks = await db.all(sql, params);
    const tasks = rawTasks.map(parseTask);
    res.json(tasks);
  } catch (err) {
    console.error('Get tasks error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/tasks/:id
router.get('/:id', async (req, res) => {
  try {
    const task = await db.get('SELECT * FROM tasks WHERE id = ? AND userId = ?', [req.params.id, req.user.id]);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(parseTask(task));
  } catch (err) {
    console.error('Get task by id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/tasks
router.post('/', async (req, res) => {
  try {
    const { title, description, dueTime, notifyTypes, recipients, notifyCycle } = req.body;
    if (!title || !dueTime) {
      return res.status(400).json({ error: 'Title and dueTime are required' });
    }

    await db.run(
      `INSERT INTO tasks (title, description, dueTime, notifyTypes, recipients, notifyCycle, userId, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        title,
        description || null,
        new Date(dueTime).toISOString(),
        JSON.stringify(notifyTypes || []),
        JSON.stringify(recipients || []),
        notifyCycle || 'none',
        req.user.id,
      ]
    );

    const taskId = db.lastInsertRowid();
    const task = await db.get('SELECT * FROM tasks WHERE id = ?', [taskId]);
    res.status(201).json(parseTask(task));
  } catch (err) {
    console.error('Create task error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/tasks/:id
router.put('/:id', async (req, res) => {
  try {
    const existing = await db.get('SELECT * FROM tasks WHERE id = ? AND userId = ?', [req.params.id, req.user.id]);
    if (!existing) return res.status(404).json({ error: 'Task not found' });

    const { title, description, dueTime, notifyTypes, recipients, isDone, notifyCycle } = req.body;

    let lastNotifiedAt = existing.lastNotifiedAt;
    const dueTimeChanged = dueTime && new Date(dueTime).toISOString() !== new Date(existing.dueTime).toISOString();
    const notifyCycleChanged = notifyCycle !== undefined && notifyCycle !== existing.notifyCycle;
    const reopened = isDone !== undefined && !isDone && existing.isDone;

    if (dueTimeChanged || notifyCycleChanged || reopened) {
      lastNotifiedAt = null;
    }

    await db.run(
      `UPDATE tasks SET
        title = ?,
        description = ?,
        dueTime = ?,
        notifyTypes = ?,
        recipients = ?,
        isDone = ?,
        notifyCycle = ?,
        lastNotifiedAt = ?,
        updatedAt = datetime('now')
       WHERE id = ? AND userId = ?`,
      [
        title ?? existing.title,
        description !== undefined ? description : existing.description,
        dueTime ? new Date(dueTime).toISOString() : existing.dueTime,
        JSON.stringify(notifyTypes ?? JSON.parse(existing.notifyTypes || '[]')),
        JSON.stringify(recipients ?? JSON.parse(existing.recipients || '[]')),
        isDone !== undefined ? (isDone ? 1 : 0) : existing.isDone,
        notifyCycle ?? existing.notifyCycle ?? 'none',
        lastNotifiedAt,
        req.params.id,
        req.user.id,
      ]
    );

    const task = await db.get('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
    res.json(parseTask(task));
  } catch (err) {
    console.error('Update task error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/tasks/:id/complete
router.patch('/:id/complete', async (req, res) => {
  try {
    const existing = await db.get('SELECT * FROM tasks WHERE id = ? AND userId = ?', [req.params.id, req.user.id]);
    if (!existing) return res.status(404).json({ error: 'Task not found' });

    const newDone = existing.isDone ? 0 : 1;
    await db.run(
      "UPDATE tasks SET isDone = ?, lastNotifiedAt = NULL, updatedAt = datetime('now') WHERE id = ?",
      [newDone, req.params.id]
    );

    const task = await db.get('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
    res.json(parseTask(task));
  } catch (err) {
    console.error('Toggle complete task error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', async (req, res) => {
  try {
    const existing = await db.get('SELECT * FROM tasks WHERE id = ? AND userId = ?', [req.params.id, req.user.id]);
    if (!existing) return res.status(404).json({ error: 'Task not found' });

    await db.run('DELETE FROM tasks WHERE id = ?', [req.params.id]);
    res.json({ message: 'Task deleted successfully' });
  } catch (err) {
    console.error('Delete task error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
