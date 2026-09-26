import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import invoicesRouter from './routes/invoices.js';
import tallyRouter from './routes/tally.js';
import mastersRouter from './routes/masters.js';
import authRouter from './routes/auth.js';
import bridgeRouter from './routes/bridge.js';
import { startCloudBridgeAgent } from './services/cloudBridgeAgent.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5005;

// Middleware with Private Network Access (PNA) support for direct browser-to-local communication
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Private-Network', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});
app.use(cors({ origin: '*' }));
app.use(express.text({ type: ['*/xml', 'application/xml', 'text/xml', 'text/plain'], limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request Logger
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/tally', tallyRouter);
app.use('/api/bridge', bridgeRouter);
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

// Serve static client build in production
const clientDistPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientDistPath));

// For SPA routing: any non-API route returns index.html
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(clientDistPath, 'index.html'), (err) => {
    if (err) {
      res.status(200).send('Yamuna Plastics API Server is online. Please build client (npm run build).');
    }
  });
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 Yamuna Plastics API Server running on port ${PORT}`);
  console.log(`📡 Invoices API:     http://localhost:${PORT}/api/invoices`);
  console.log(`📦 Tally XML Export: http://localhost:${PORT}/api/tally/export-xml`);
  console.log(`🔌 Tally Sync Status:http://localhost:${PORT}/api/tally/status`);
  console.log(`=======================================================`);

  // Start background real-time sync bridge for 1-click cloud sync
  startCloudBridgeAgent();
});
