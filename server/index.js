import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import { initDb, getDriver } from './lib/db.js';
import { requireAuth, ensureSeedUser, getBridgeKey } from './lib/auth.js';
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

app.disable('x-powered-by');

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Private-Network', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Bridge-Key, X-Requested-With');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(cors({ origin: '*' }));
app.use(express.text({ type: ['*/xml', 'application/xml', 'text/xml', 'text/plain'], limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// The database has to be live before any route handler touches it.
let dbReady = null;
app.use(async (req, res, next) => {
  if (!req.path.startsWith('/api')) return next();
  try {
    await dbReady;
    next();
  } catch (err) {
    res.status(503).json({ status: 'starting', error: err.message });
  }
});

// Health is public and reports real state, including which DB is in use.
app.get('/api/health', async (req, res) => {
  res.json({
    status: 'online',
    app: 'Yamuna Plastics Billing & Tally Engine',
    version: '2.0.0',
    database: getDriver(),
    bridgeKeyConfigured: Boolean(getBridgeKey()),
    timestamp: new Date().toISOString()
  });
});

// Everything else needs a session token or the bridge key.
app.use('/api', requireAuth);

app.use('/api/auth', authRouter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/tally', tallyRouter);
app.use('/api/bridge', bridgeRouter);
app.use('/api', mastersRouter);

const clientDistPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientDistPath));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDistPath, 'index.html'), (err) => {
    if (err) {
      res.status(200).send('Yamuna Plastics API Server is online. Build the client with `npm run build`.');
    }
  });
});

dbReady = (async () => {
  await initDb();
  await ensureSeedUser();
})();

dbReady
  .then(() => {
    app.listen(PORT, () => {
      console.log('=======================================================');
      console.log(`Yamuna Plastics API listening on port ${PORT}`);
      console.log(`Database driver : ${getDriver()}`);
      console.log(`Bridge key     : ${getBridgeKey() ? 'configured' : 'NOT CONFIGURED (set BRIDGE_KEY)'}`);
      console.log(`Portal         : ${process.env.CLOUD_URL || 'https://yamuna.sanmatisolution.com'}`);
      console.log('=======================================================');
      startCloudBridgeAgent();
    });
  })
  .catch((err) => {
    console.error('Failed to start:', err);
    process.exit(1);
  });
