import express from 'express';
import {
  getBridgeState,
  recordHeartbeat,
  recordSyncResult,
  recordTallyReading,
  queueBridgeCommand,
  claimPendingCommand,
  completeBridgeCommand,
  getBridgeCommand,
  hasPendingBridgeCommand
} from '../lib/db.js';

const router = express.Router();

const AGENT_STALE_MS = 90 * 1000; // the agent beats every 15s

let lastSyncResult = null;

function isAgentOnline(bridge) {
  return Boolean(bridge?.lastHeartbeat && Date.now() - new Date(bridge.lastHeartbeat).getTime() < AGENT_STALE_MS);
}

/** 1. Web UI asks the local agent to run a sync cycle. */
router.post('/trigger', async (req, res) => {
  try {
    const { type = 'SYNC_ALL' } = req.body || {};
    const command = await queueBridgeCommand(type);
    const bridge = await getBridgeState();
    const online = isAgentOnline(bridge);

    // The command is queued either way. It stays PENDING until an agent picks
    // it up, so asking for a sync while the PC is off works once it comes back
    // rather than being silently dropped.
    res.json({
      success: true,
      commandId: command._id,
      agentOnline: online,
      queued: true,
      message: online
        ? 'Sync command queued for the local Tally agent.'
        : 'The Tally agent on the office PC is not reachable right now. The command is saved and will run as soon as that PC is on with Tally open.'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** 2. Local agent polls for work. */
router.get('/poll', async (req, res) => {
  try {
    const command = await claimPendingCommand();
    res.json({
      hasPending: Boolean(command),
      command: command ? { id: command._id, type: command.type } : null,
      serverTime: Date.now()
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** 3. Local agent reports the outcome. */
router.post('/complete', async (req, res) => {
  try {
    const { commandId, success, result, error } = req.body || {};
    await completeBridgeCommand(commandId, { success, result, error });
    lastSyncResult = { commandId, success: Boolean(success), result, error, timestamp: Date.now() };
    try {
      await recordSyncResult(result || { error }, result?.tallyMaxVoucher, result?.tallyCompany);
    } catch (err) {
      console.warn('[bridge] could not record sync result:', err.message);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** 4. Web UI waits on the command. */
router.get('/status/:commandId', async (req, res) => {
  try {
    const { commandId } = req.params;
    const command = await getBridgeCommand(commandId);
    if (command) {
      return res.json({
        commandId,
        status: command.status,
        result: command.result,
        error: command.error
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
      pendingCommand: await hasPendingBridgeCommand(),
      lastSyncResult
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
