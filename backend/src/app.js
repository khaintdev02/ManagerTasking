require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { getDb } = require('./config/db');

// Import routes
const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');
const adminRoutes = require('./routes/admin');
const pushRoutes = require('./routes/push');
const transactionRoutes = require('./routes/transactions');

// Import cron service
const { startCronJob } = require('./services/cronService');

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'http://localhost:4173'
];

if (process.env.APP_URL) {
  allowedOrigins.push(process.env.APP_URL);
  // Also push without trailing slash if present
  allowedOrigins.push(process.env.APP_URL.replace(/\/$/, ''));
}

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/transactions', transactionRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize database then start server
async function bootstrap() {
  try {
    await getDb(); // Initialize sql.js DB and create tables

    app.listen(PORT, () => {
      console.log(`[Server] Running on http://localhost:${PORT}`);
    });

    startCronJob();
  } catch (err) {
    console.error('[Server] Failed to start:', err);
    process.exit(1);
  }
}

bootstrap();
