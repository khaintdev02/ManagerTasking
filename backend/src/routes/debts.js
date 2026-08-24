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

function parsePayment(p) {
  if (!p) return null;
  return {
    ...p,
    amount: parseFloat(p.amount),
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

// GET /api/debts/summary - Get total debt, total loan, and net balance accounting for partial repayments
router.get('/summary', async (req, res) => {
  try {
    const userId = req.user.id;

    // Sum all debts by type
    const debtRows = await db.all('SELECT type, SUM(amount) as total FROM debts WHERE userId = ? GROUP BY type', [userId]);
    // Sum all payments by type
    const payRows = await db.all('SELECT type, SUM(amount) as total FROM debt_payments WHERE userId = ? GROUP BY type', [userId]);

    let debtTotal = 0;
    let loanTotal = 0;
    debtRows.forEach(r => {
      if (r.type === 'debt') debtTotal = parseFloat(r.total || 0);
      if (r.type === 'loan') loanTotal = parseFloat(r.total || 0);
    });

    let debtPaid = 0;
    let loanPaid = 0;
    payRows.forEach(r => {
      if (r.type === 'debt') debtPaid = parseFloat(r.total || 0);
      if (r.type === 'loan') loanPaid = parseFloat(r.total || 0);
    });

    const activeDebt = Math.max(0, debtTotal - debtPaid);
    const activeLoan = Math.max(0, loanTotal - loanPaid);

    res.json({
      totalDebt: activeDebt,
      totalLoan: activeLoan,
      originalDebt: debtTotal,
      originalLoan: loanTotal,
      paidDebt: debtPaid,
      paidLoan: loanPaid,
      netBalance: activeLoan - activeDebt
    });
  } catch (err) {
    console.error('Get debts summary error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/debts/people - Get aggregated list of debts and repayments grouped by person
router.get('/people', async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, search } = req.query;

    let debtsSql = 'SELECT * FROM debts WHERE userId = ?';
    const debtsParams = [userId];
    if (type) {
      debtsSql += ' AND type = ?';
      debtsParams.push(type);
    }
    if (search) {
      debtsSql += ' AND (person LIKE ? OR description LIKE ?)';
      debtsParams.push(`%${search}%`, `%${search}%`);
    }
    debtsSql += ' ORDER BY createdAt DESC';

    const debtsRaw = await db.all(debtsSql, debtsParams);
    const debts = debtsRaw.map(parseDebt);

    let paymentsSql = 'SELECT * FROM debt_payments WHERE userId = ?';
    const paymentsParams = [userId];
    if (type) {
      paymentsSql += ' AND type = ?';
      paymentsParams.push(type);
    }
    paymentsSql += ' ORDER BY paymentDate DESC, createdAt DESC';

    const paymentsRaw = await db.all(paymentsSql, paymentsParams);
    const payments = paymentsRaw.map(parsePayment);

    // Grouping by person and type
    const groupsMap = {};

    debts.forEach(d => {
      const key = `${d.person.trim().toLowerCase()}_${d.type}`;
      if (!groupsMap[key]) {
        groupsMap[key] = {
          key,
          person: d.person.trim(),
          type: d.type,
          totalAmount: 0,
          paidAmount: 0,
          debts: [],
          payments: [],
          dueDates: [],
          lastActivity: d.createdAt || ''
        };
      }
      groupsMap[key].totalAmount += d.amount;
      groupsMap[key].debts.push(d);
      if (d.dueDate) {
        groupsMap[key].dueDates.push(d.dueDate);
      }
      if (d.createdAt && d.createdAt > groupsMap[key].lastActivity) {
        groupsMap[key].lastActivity = d.createdAt;
      }
    });

    payments.forEach(p => {
      const key = `${p.person.trim().toLowerCase()}_${p.type}`;
      if (!groupsMap[key]) {
        groupsMap[key] = {
          key,
          person: p.person.trim(),
          type: p.type,
          totalAmount: 0,
          paidAmount: 0,
          debts: [],
          payments: [],
          dueDates: [],
          lastActivity: p.paymentDate || p.createdAt || ''
        };
      }
      groupsMap[key].paidAmount += p.amount;
      groupsMap[key].payments.push(p);
      const activity = p.paymentDate || p.createdAt || '';
      if (activity > groupsMap[key].lastActivity) {
        groupsMap[key].lastActivity = activity;
      }
    });

    const people = Object.values(groupsMap).map(g => {
      const remainingAmount = Math.max(0, g.totalAmount - g.paidAmount);
      const status = (g.totalAmount > 0 && remainingAmount <= 0) ? 'settled' : 'pending';
      const progressPercent = g.totalAmount > 0 
        ? Math.min(100, Math.round((g.paidAmount / g.totalAmount) * 100)) 
        : 100;

      return {
        ...g,
        remainingAmount,
        status,
        progressPercent,
        hasOverdue: g.dueDates.some(due => due < new Date().toISOString().substring(0, 10)) && status === 'pending'
      };
    });

    // Sort: Pending first, then by lastActivity DESC
    people.sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === 'pending' ? -1 : 1;
      }
      return (b.lastActivity || '').localeCompare(a.lastActivity || '');
    });

    res.json(people);
  } catch (err) {
    console.error('Get people debts error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/debts/payments - Record a partial or full debt repayment
router.post('/payments', async (req, res) => {
  try {
    const { person, type, amount, paymentDate, note, debtId } = req.body;
    const userId = req.user.id;

    if (!person || person.trim() === '') {
      return res.status(400).json({ error: 'Person name is required' });
    }
    if (!type || !['debt', 'loan'].includes(type)) {
      return res.status(400).json({ error: 'Type must be debt or loan' });
    }
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }

    const payDate = paymentDate || new Date().toISOString().substring(0, 10);

    const insertSql = db.isPg ?
      `INSERT INTO debt_payments (person, type, amount, paymentDate, note, debtId, userId, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)` :
      `INSERT INTO debt_payments (person, type, amount, paymentDate, note, debtId, userId, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`;

    await db.run(insertSql, [
      person.trim(),
      type,
      parseFloat(amount),
      payDate,
      note || null,
      debtId || null,
      userId
    ]);

    const paymentId = db.lastInsertRowid();
    const payment = await db.get('SELECT * FROM debt_payments WHERE id = ?', [paymentId]);

    // Check if all debts of this person are now settled
    const debtTotalRow = await db.get(
      'SELECT SUM(amount) as total FROM debts WHERE userId = ? AND LOWER(person) = LOWER(?) AND type = ?',
      [userId, person.trim(), type]
    );
    const payTotalRow = await db.get(
      'SELECT SUM(amount) as total FROM debt_payments WHERE userId = ? AND LOWER(person) = LOWER(?) AND type = ?',
      [userId, person.trim(), type]
    );

    const totalDebtAmount = parseFloat(debtTotalRow?.total || 0);
    const totalPaidAmount = parseFloat(payTotalRow?.total || 0);

    if (totalDebtAmount > 0 && totalPaidAmount >= totalDebtAmount) {
      await db.run(
        'UPDATE debts SET status = ?, settledAt = ? WHERE userId = ? AND LOWER(person) = LOWER(?) AND type = ?',
        ['settled', payDate, userId, person.trim(), type]
      );
    }

    res.status(201).json(parsePayment(payment));
  } catch (err) {
    console.error('Create debt payment error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/debts/payments - Get repayment logs
router.get('/payments', async (req, res) => {
  try {
    const userId = req.user.id;
    const { person, type } = req.query;

    let sql = 'SELECT * FROM debt_payments WHERE userId = ?';
    const params = [userId];

    if (person) {
      sql += ' AND LOWER(person) = LOWER(?)';
      params.push(person.trim());
    }
    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }

    sql += ' ORDER BY paymentDate DESC, createdAt DESC';

    const raw = await db.all(sql, params);
    const payments = raw.map(parsePayment);
    res.json(payments);
  } catch (err) {
    console.error('Get debt payments error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/debts/payments/:id - Delete a repayment log
router.delete('/payments/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const existing = await db.get('SELECT * FROM debt_payments WHERE id = ? AND userId = ?', [req.params.id, userId]);
    if (!existing) {
      return res.status(404).json({ error: 'Payment record not found' });
    }

    await db.run('DELETE FROM debt_payments WHERE id = ?', [req.params.id]);

    // Recalculate and update status if needed
    const debtTotalRow = await db.get(
      'SELECT SUM(amount) as total FROM debts WHERE userId = ? AND LOWER(person) = LOWER(?) AND type = ?',
      [userId, existing.person, existing.type]
    );
    const payTotalRow = await db.get(
      'SELECT SUM(amount) as total FROM debt_payments WHERE userId = ? AND LOWER(person) = LOWER(?) AND type = ?',
      [userId, existing.person, existing.type]
    );

    const totalDebtAmount = parseFloat(debtTotalRow?.total || 0);
    const totalPaidAmount = parseFloat(payTotalRow?.total || 0);

    if (totalDebtAmount > totalPaidAmount) {
      await db.run(
        'UPDATE debts SET status = ?, settledAt = NULL WHERE userId = ? AND LOWER(person) = LOWER(?) AND type = ?',
        ['pending', userId, existing.person, existing.type]
      );
    }

    res.json({ message: 'Payment record deleted successfully' });
  } catch (err) {
    console.error('Delete debt payment error:', err);
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
