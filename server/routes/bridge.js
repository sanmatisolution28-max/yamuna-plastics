import express from 'express';
import { getBridgeState, recordHeartbeat, recordSyncResult, recordTallyReading } from '../lib/db.js';

const router = express.Router();

const COMMAND_TTL_MS = 45 * 1000;
const AGENT_STALE_MS = 90 * 1000; // the agent beats every 15s

let activeCommand = null;
let lastSyncResult = null;

function isAgentOnline(bridge) {
  return Boolean(bridge?.lastHeartbeat && Date.now() - new Date(bridge.lastHeartbeat).getTime() < AGENT_STALE_MS);
}

/** 1. Web UI asks the local agent to run a sync cycle. */
router.post('/trigger', (req, res) => {
  const { type = 'SYNC_ALL' } = req.body || {};
  activeCommand = {
    id: `CMD-${Date.now()}`,
    type,
    status: 'PENDING',
    createdAt: Date.now()
  };
  res.json({
    success: true,
    commandId: activeCommand.id,
    message: 'Sync command queued for the local Tally agent.'
  });
});

/** 2. Local agent polls for work. */
router.get('/poll', (req, res) => {
  if (activeCommand && Date.now() - activeCommand.createdAt > COMMAND_TTL_MS) {
    activeCommand = null;
  }
  res.json({
    hasPending: Boolean(activeCommand && activeCommand.status === 'PENDING'),
    command: activeCommand && activeCommand.status === 'PENDING' ? activeCommand : null,
    serverTime: Date.now()
  });
});

/** 3. Local agent reports the outcome. */
router.post('/complete', async (req, res) => {
  const { commandId, success, result, error } = req.body || {};
  if (activeCommand && (!commandId || activeCommand.id === commandId)) {
    activeCommand.status = success ? 'COMPLETED' : 'FAILED';
    activeCommand.completedAt = Date.now();
    activeCommand.result = result;
    activeCommand.error = error;
  }
  lastSyncResult = { commandId, success: Boolean(success), result, error, timestamp: Date.now() };
  try {
    await recordSyncResult(result || { error }, result?.tallyMaxVoucher, result?.tallyCompany);
  } catch (err) {
    console.warn('[bridge] could not record sync result:', err.message);
  }
  res.json({ success: true });
});

/** 4. Web UI waits on the command. */
router.get('/status/:commandId', (req, res) => {
  const { commandId } = req.params;
  if (activeCommand && activeCommand.id === commandId) {
    return res.json({
      commandId,
      status: activeCommand.status,
      result: activeCommand.result,
      error: activeCommand.error
    });
  }
  if (lastSyncResult && lastSyncResult.commandId === commandId) {
    return res.json({
      commandId,
      status: lastSyncResult.success ? 'COMPLETED' : 'FAILED',
      result: lastSyncResult.result,
      error: lastSyncResult.error
    });
  }
  res.json({ commandId, status: 'NOT_FOUND' });
});

/**
 * 5. Cheap liveness ping. The agent calls this often so the UI can tell the
 *    difference between "Tally is down" and "the agent is not running".
 */
router.get('/heartbeat', async (req, res) => {
  try {
    await recordHeartbeat();
    res.json({ success: true, serverTime: Date.now() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** 6. Agent reports Tally's highest voucher number. */
router.post('/tally-reading', async (req, res) => {
  try {
    const { maxVoucher, voucherCount, company } = req.body || {};
    await recordTallyReading(Number(maxVoucher || 0), company || '');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 7. Health. Liveness is read from the database heartbeat rather than an
 *    in-memory variable, so it survives a server restart and reflects the agent
 *    that is actually running now.
 */
router.get('/health', async (req, res) => {
  try {
    const bridge = await getBridgeState();
    const online = isAgentOnline(bridge);
    res.json({
      bridgeOnline: true,
      localAgentConnected: online,
      lastHeartbeat: bridge?.lastHeartbeat || null,
      lastSyncAt: bridge?.lastSyncAt || null,
      tallyMaxVoucher: bridge?.tallyMaxVoucher || 0,
      tallyCompany: bridge?.tallyCompany || null,
      lastSyncResult
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
