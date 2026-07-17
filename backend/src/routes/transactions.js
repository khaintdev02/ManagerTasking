const express = require('express');
const db = require('../config/db');

const router = express.Router();
router.use(authMiddleware);

function authMiddleware(req, res, next) {
  require('../middleware/auth')(req, res, next);
}

// Helper to format/parse transaction fields
function parseTransaction(t) {
  if (!t) return null;
  return {
    ...t,
    amount: parseFloat(t.amount),
  };
}

// GET /api/transactions - Get list of transactions
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { startDate, endDate, type, category, paymentMethod } = req.query;

    let sql = 'SELECT * FROM transactions WHERE userId = ?';
    const params = [userId];

    if (startDate) {
      sql += ' AND date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND date <= ?';
      params.push(endDate);
    }
    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }
    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }
    if (paymentMethod) {
      sql += ' AND paymentMethod = ?';
      params.push(paymentMethod);
    }

    sql += ' ORDER BY date DESC, id DESC';

    const raw = await db.all(sql, params);
    const transactions = raw.map(parseTransaction);
    res.json(transactions);
  } catch (err) {
    console.error('Get transactions error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/transactions/stats - Get analytics and summary
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user.id;
    // Default to current month if no month/year is provided (format YYYY-MM)
    const currentMonthStr = new Date().toISOString().substring(0, 7); 
    const month = req.query.month || currentMonthStr; // e.g. "2026-07"

    // 1. Calculate overall totals for this month
    const totalSql = `
      SELECT type, SUM(amount) as total 
      FROM transactions 
      WHERE userId = ? AND date LIKE ? 
      GROUP BY type
    `;
    const totals = await db.all(totalSql, [userId, `${month}%`]);
    let totalIncome = 0;
    let totalExpense = 0;
    totals.forEach(row => {
      if (row.type === 'income') totalIncome = parseFloat(row.total || 0);
      if (row.type === 'expense') totalExpense = parseFloat(row.total || 0);
    });

    // 2. Category breakdown for this month (expenses only, or both)
    const categorySql = `
      SELECT type, category, SUM(amount) as total
      FROM transactions
      WHERE userId = ? AND date LIKE ?
      GROUP BY type, category
      ORDER BY total DESC
    `;
    const categoriesRaw = await db.all(categorySql, [userId, `${month}%`]);
    const categoryBreakdown = categoriesRaw.map(r => ({
      type: r.type,
      category: r.category,
      total: parseFloat(r.total || 0)
    }));

    // 3. Daily transaction stats for chart (last 30 days or selected month)
    // We get daily stats for the chosen month
    const dailySql = `
      SELECT date, type, SUM(amount) as total
      FROM transactions
      WHERE userId = ? AND date LIKE ?
      GROUP BY date, type
      ORDER BY date ASC
    `;
    const dailyRaw = await db.all(dailySql, [userId, `${month}%`]);
    const dailyStats = dailyRaw.map(r => ({
      date: r.date,
      type: r.type,
      total: parseFloat(r.total || 0)
    }));

    // 4. Overall lifetime stats (total balance)
    const lifetimeSql = `
      SELECT type, SUM(amount) as total
      FROM transactions
      WHERE userId = ?
      GROUP BY type
    `;
    const lifetimeTotals = await db.all(lifetimeSql, [userId]);
    let lifetimeIncome = 0;
    let lifetimeExpense = 0;
    lifetimeTotals.forEach(row => {
      if (row.type === 'income') lifetimeIncome = parseFloat(row.total || 0);
      if (row.type === 'expense') lifetimeExpense = parseFloat(row.total || 0);
    });

    res.json({
      month,
      summary: {
        monthIncome: totalIncome,
        monthExpense: totalExpense,
        monthBalance: totalIncome - totalExpense,
        lifetimeBalance: lifetimeIncome - lifetimeExpense,
      },
      categoryBreakdown,
      dailyStats
    });
  } catch (err) {
    console.error('Get transaction stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/transactions - Add a transaction
router.post('/', async (req, res) => {
  try {
    const { amount, type, category, paymentMethod, description, date } = req.body;
    const userId = req.user.id;

    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Amount must be a number greater than 0' });
    }
    if (!type || !['income', 'expense'].includes(type)) {
      return res.status(400).json({ error: 'Type must be income or expense' });
    }
    if (!category) {
      return res.status(400).json({ error: 'Category is required' });
    }
    if (!paymentMethod) {
      return res.status(400).json({ error: 'Payment method is required' });
    }
    // Default to current local date (YYYY-MM-DD) if not provided
    const transactionDate = date || new Date().toISOString().substring(0, 10);

    const insertSql = db.isPg ? 
      `INSERT INTO transactions (amount, type, category, paymentMethod, description, date, userId, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)` :
      `INSERT INTO transactions (amount, type, category, paymentMethod, description, date, userId, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`;

    await db.run(insertSql, [
      parseFloat(amount),
      type,
      category,
      paymentMethod,
      description || null,
      transactionDate,
      userId
    ]);

    const transactionId = db.lastInsertRowid();
    const transaction = await db.get('SELECT * FROM transactions WHERE id = ?', [transactionId]);
    res.status(201).json(parseTransaction(transaction));
  } catch (err) {
    console.error('Create transaction error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/transactions/:id - Update transaction
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const existing = await db.get('SELECT * FROM transactions WHERE id = ? AND userId = ?', [req.params.id, userId]);
    if (!existing) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const { amount, type, category, paymentMethod, description, date } = req.body;

    const newAmount = amount !== undefined ? parseFloat(amount) : existing.amount;
    const newType = type || existing.type;
    const newCategory = category || existing.category;
    const newPaymentMethod = paymentMethod || existing.paymentMethod;
    const newDescription = description !== undefined ? description : existing.description;
    const newDate = date || existing.date;

    if (isNaN(newAmount) || newAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be a number greater than 0' });
    }
    if (!['income', 'expense'].includes(newType)) {
      return res.status(400).json({ error: 'Type must be income or expense' });
    }

    const updateSql = db.isPg ?
      `UPDATE transactions SET 
        amount = ?, type = ?, category = ?, paymentMethod = ?, description = ?, date = ?, updatedAt = CURRENT_TIMESTAMP
       WHERE id = ? AND userId = ?` :
      `UPDATE transactions SET 
        amount = ?, type = ?, category = ?, paymentMethod = ?, description = ?, date = ?, updatedAt = datetime('now')
       WHERE id = ? AND userId = ?`;

    await db.run(updateSql, [
      newAmount,
      newType,
      newCategory,
      newPaymentMethod,
      newDescription,
      newDate,
      req.params.id,
      userId
    ]);

    const transaction = await db.get('SELECT * FROM transactions WHERE id = ?', [req.params.id]);
    res.json(parseTransaction(transaction));
  } catch (err) {
    console.error('Update transaction error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/transactions/:id - Delete transaction
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const existing = await db.get('SELECT * FROM transactions WHERE id = ? AND userId = ?', [req.params.id, userId]);
    if (!existing) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    await db.run('DELETE FROM transactions WHERE id = ?', [req.params.id]);
    res.json({ message: 'Transaction deleted successfully' });
  } catch (err) {
    console.error('Delete transaction error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
