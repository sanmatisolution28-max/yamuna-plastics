import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import invoicesRouter from './routes/invoices.js';
import tallyRouter from './routes/tally.js';
import mastersRouter from './routes/masters.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5005;

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request Logger
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

// API Routes
app.use('/api/invoices', invoicesRouter);
app.use('/api/tally', tallyRouter);
app.use('/api', mastersRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    app: 'Yamuna Plastics Billing & Tally Engine',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 Yamuna Plastics API Server running on port ${PORT}`);
  console.log(`📡 Invoices API:     http://localhost:${PORT}/api/invoices`);
  console.log(`📦 Tally XML Export: http://localhost:${PORT}/api/tally/export-xml`);
  console.log(`🔌 Tally Sync Status:http://localhost:${PORT}/api/tally/status`);
  console.log(`=======================================================`);
});
