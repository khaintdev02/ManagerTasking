const express = require('express');
const db = require('../config/db');

const router = express.Router();
router.use(authMiddleware);

function authMiddleware(req, res, next) {
  require('../middleware/auth')(req, res, next);
}

function parseDebt(d) {
  if (!d) return null;
  return {
    ...d,
    amount: parseFloat(d.amount),
  };
}

// GET /api/debts - List debts of the current user
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, status, search } = req.query;

    let sql = 'SELECT * FROM debts WHERE userId = ?';
    const params = [userId];

    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (search) {
      sql += ' AND (person LIKE ? OR description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY status ASC, createdAt DESC';

    const raw = await db.all(sql, params);
    const debts = raw.map(parseDebt);
    res.json(debts);
  } catch (err) {
    console.error('Get debts error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/debts/summary - Get total debt, total loan, and net balance
router.get('/summary', async (req, res) => {
  try {
    const userId = req.user.id;

    // We only sum pending (unpaid) debts/loans for active financial summaries
    const sql = 'SELECT type, SUM(amount) as total FROM debts WHERE userId = ? AND status = ? GROUP BY type';
    const rows = await db.all(sql, [userId, 'pending']);

    let totalDebt = 0;
    let totalLoan = 0;

    rows.forEach(r => {
      if (r.type === 'debt') totalDebt = parseFloat(r.total || 0);
      if (r.type === 'loan') totalLoan = parseFloat(r.total || 0);
    });

    res.json({
      totalDebt,
      totalLoan,
      netBalance: totalLoan - totalDebt
    });
  } catch (err) {
    console.error('Get debts summary error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/debts - Add a new debt/loan
router.post('/', async (req, res) => {
  try {
    const { type, person, amount, description, dueDate, status } = req.body;
    const userId = req.user.id;

    if (!type || !['debt', 'loan'].includes(type)) {
      return res.status(400).json({ error: 'Type must be debt or loan' });
    }
    if (!person || person.trim() === '') {
      return res.status(400).json({ error: 'Person name is required' });
    }
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Amount must be a number greater than 0' });
    }

    const debtStatus = status || 'pending';
    const settledAt = debtStatus === 'settled' ? new Date().toISOString().substring(0, 10) : null;

    const insertSql = db.isPg ?
      `INSERT INTO debts (type, person, amount, description, dueDate, status, settledAt, userId, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)` :
      `INSERT INTO debts (type, person, amount, description, dueDate, status, settledAt, userId, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`;

    await db.run(insertSql, [
      type,
      person.trim(),
      parseFloat(amount),
      description || null,
      dueDate || null,
      debtStatus,
      settledAt,
      userId
    ]);

    const debtId = db.lastInsertRowid();
    const debt = await db.get('SELECT * FROM debts WHERE id = ?', [debtId]);
    res.status(201).json(parseDebt(debt));
  } catch (err) {
    console.error('Create debt error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/debts/:id - Update debt details or toggle status
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const existing = await db.get('SELECT * FROM debts WHERE id = ? AND userId = ?', [req.params.id, userId]);
    if (!existing) {
      return res.status(404).json({ error: 'Debt record not found' });
    }

    const { type, person, amount, description, dueDate, status } = req.body;

    const newType = type || existing.type;
    const newPerson = person !== undefined ? person.trim() : existing.person;
    const newAmount = amount !== undefined ? parseFloat(amount) : existing.amount;
    const newDescription = description !== undefined ? description : existing.description;
    const newDueDate = dueDate !== undefined ? dueDate : existing.dueDate;
    const newStatus = status || existing.status;

    if (!['debt', 'loan'].includes(newType)) {
      return res.status(400).json({ error: 'Type must be debt or loan' });
    }
    if (!newPerson || newPerson === '') {
      return res.status(400).json({ error: 'Person name is required' });
    }
    if (isNaN(newAmount) || newAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be a number greater than 0' });
    }

    let newSettledAt = existing.settledAt;
    if (newStatus === 'settled' && existing.status !== 'settled') {
      newSettledAt = new Date().toISOString().substring(0, 10);
    } else if (newStatus === 'pending') {
      newSettledAt = null;
    }

    const updateSql = db.isPg ?
      `UPDATE debts SET 
        type = ?, person = ?, amount = ?, description = ?, dueDate = ?, status = ?, settledAt = ?, updatedAt = CURRENT_TIMESTAMP
       WHERE id = ? AND userId = ?` :
      `UPDATE debts SET 
        type = ?, person = ?, amount = ?, description = ?, dueDate = ?, status = ?, settledAt = ?, updatedAt = datetime('now')
       WHERE id = ? AND userId = ?`;

    await db.run(updateSql, [
      newType,
      newPerson,
      newAmount,
      newDescription,
      newDueDate,
      newStatus,
      newSettledAt,
      req.params.id,
      userId
    ]);

    const debt = await db.get('SELECT * FROM debts WHERE id = ?', [req.params.id]);
    res.json(parseDebt(debt));
  } catch (err) {
    console.error('Update debt error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/debts/:id - Delete debt record
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const existing = await db.get('SELECT * FROM debts WHERE id = ? AND userId = ?', [req.params.id, userId]);
    if (!existing) {
      return res.status(404).json({ error: 'Debt record not found' });
    }

    await db.run('DELETE FROM debts WHERE id = ?', [req.params.id]);
    res.json({ message: 'Debt record deleted successfully' });
  } catch (err) {
    console.error('Delete debt error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
