import express from 'express';

const router = express.Router();

// In-memory or state storage for sync bridge commands
let activeCommand = null;
let lastSyncResult = null;
let lastHeartbeat = 0;

/**
 * 1. Web UI triggers a sync (Called when user clicks "⚡ Sync Tally" on the web app)
 */
router.post('/trigger', (req, res) => {
  const { type = 'SYNC_ALL' } = req.body || {};
  const cmdId = `CMD-${Date.now()}`;
  activeCommand = {
    id: cmdId,
    type,
    status: 'PENDING',
    createdAt: Date.now()
  };

  res.json({
    success: true,
    commandId: cmdId,
    message: 'Sync command queued for local Tally agent'
  });
});

/**
 * 2. Local Tally Daemon polls for commands (Called every 2-3s by local PC background service)
 */
router.get('/poll', (req, res) => {
  lastHeartbeat = Date.now();

  // Expire commands older than 45 seconds
  if (activeCommand && Date.now() - activeCommand.createdAt > 45000) {
    activeCommand = null;
  }

  res.json({
    hasPending: Boolean(activeCommand && activeCommand.status === 'PENDING'),
    command: activeCommand && activeCommand.status === 'PENDING' ? activeCommand : null,
    serverTime: Date.now()
  });
});

/**
 * 3. Local Tally Daemon reports completion of sync command
 */
router.post('/complete', async (req, res) => {
  const { commandId, success, result, error } = req.body || {};
  lastHeartbeat = Date.now();

  if (activeCommand && (!commandId || activeCommand.id === commandId)) {
    activeCommand.status = success ? 'COMPLETED' : 'FAILED';
    activeCommand.completedAt = Date.now();
    activeCommand.result = result;
    activeCommand.error = error;
  }

  lastSyncResult = {
    commandId,
    success: Boolean(success),
    result,
    error,
    timestamp: Date.now()
  };

  res.json({ success: true });
});

/**
 * 4. Web UI checks status of the sync command (Polled by browser until complete)
 */
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

  res.json({
    commandId,
    status: 'NOT_FOUND'
  });
});

/**
 * 5. General Bridge Health
 */
router.get('/health', (req, res) => {
  const isAgentActive = Date.now() - lastHeartbeat < 15000;
  res.json({
    bridgeOnline: true,
    localAgentConnected: isAgentActive,
    lastHeartbeat: lastHeartbeat ? new Date(lastHeartbeat).toISOString() : null,
    lastSyncResult
  });
});

export default router;
