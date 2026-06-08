const {Client, RemoteAuth} = require('whatsapp-web.js');
const mongoose = require('mongoose');
const fs = require('fs');
const os = require('os');
const path = require('path');
const qrcode = require('qrcode');
const Session = require('../models/Session');
const FixedMongoStore = require('../config/fixedMongoStore');
const { resolveChromeExecutable } = require('../config/puppeteerEnv');
const {
  AUTH_DATA_PATH,
  canRecoverSession,
  cleanupLocalAuthArtifacts,
  deleteStoredRemoteSession
} = require('../utils/whatsappSession');

//client store
const clients=new Map();
// Track clients being created to prevent duplicates
const clientsBeingCreated = new Set();

// Render has limited RAM — only launch one Chrome at a time to avoid OOM restarts
let browserLaunchChain = Promise.resolve();

const withBrowserLaunchLock = async (fn) => {
  const run = browserLaunchChain.then(fn);
  browserLaunchChain = run.catch(() => {});
  return run;
};

const isProductionLinux = () =>
  process.platform === 'linux' &&
  (process.env.NODE_ENV === 'production' || process.env.RENDER === 'true');

const getPuppeteerArgs = () => {
  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-web-resources',
    '--disable-default-apps',
    '--disable-popup-blocking',
    '--no-zygote',
    '--disable-software-rasterizer',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-sync',
    '--mute-audio',
    '--hide-scrollbars'
  ];

  if (isProductionLinux()) {
    args.push('--single-process');
  }

  return args;
};

const getPuppeteerLaunchOptions = (executablePath) => ({
  headless: true,
  executablePath: executablePath || undefined,
  args: getPuppeteerArgs(),
  timeout: isProductionLinux() ? 120000 : 60000,
  protocolTimeout: isProductionLinux() ? 120000 : 60000
});

const getQrTimeoutMs = () => (isProductionLinux() ? 90000 : 30000);

const RECOVERY_QR_GRACE_MS = 90000;
const REMOTE_SESSION_BACKUP_MS = 60000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const sessionSaveInFlight = new Map();

const persistRemoteSession = async (client, userIdStr) => {
    if (sessionSaveInFlight.has(userIdStr)) {
        return sessionSaveInFlight.get(userIdStr);
    }

    const strategy = client?.authStrategy;
    if (!strategy || typeof strategy.storeRemoteSession !== 'function') return;

    const savePromise = (async () => {
        try {
            const tempDir = strategy.tempDir;
            if (tempDir && fs.existsSync(tempDir)) {
                await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
            }

            await strategy.storeRemoteSession({ emit: true });
            console.log(`✅ WhatsApp session saved to MongoDB for user: ${userIdStr}`);
        } catch (err) {
            console.error(`Failed to save WhatsApp session for user ${userIdStr}:`, err.message);
        } finally {
            sessionSaveInFlight.delete(userIdStr);
        }
    })();

    sessionSaveInFlight.set(userIdStr, savePromise);
    return savePromise;
};

const scheduleSessionBackup = (client, userIdStr, delayMs = 20000) => {
    const entry = clients.get(userIdStr);
    if (!entry) return;

    if (entry.sessionBackupTimer) {
        clearTimeout(entry.sessionBackupTimer);
    }

    entry.sessionBackupTimer = setTimeout(() => {
        persistRemoteSession(client, userIdStr).catch(() => {});
    }, delayMs);
};

const isClientReady = (userId) => {
    const entry = clients.get(userId.toString());
    return Boolean(
        entry?.client &&
        entry.status === 'connected' &&
        typeof entry.client.sendMessage === 'function'
    );
};

const waitForClientReady = async (userId, maxMs = 20000) => {
    const started = Date.now();

    while (Date.now() - started < maxMs) {
        if (isClientReady(userId)) {
            return getClient(userId);
        }
        await sleep(500);
    }

    return null;
};

const isBrowserAlreadyRunningError = (err) =>
    /browser is already running/i.test(err?.message || '');

const cleanupClient = async (client) => {
    if (!client) return;

    try {
        if (client._healthCheckCleanup) {
            client._healthCheckCleanup();
        }
    } catch (err) {
        console.error(`Error cleaning health check: ${err.message}`);
    }

    try {
        await forceReleaseClient(client);
    } catch (err) {
        console.error(`Error releasing client browser: ${err.message}`);
    }
};

const forceReleaseClient = async (client) => {
    if (!client) return;

    try {
        const browserProcess = client.pupBrowser?.process?.();
        if (browserProcess && !browserProcess.killed) {
            browserProcess.kill();
        }
    } catch (err) {
        console.warn(`Error force-killing browser process: ${err.message}`);
    }

    try {
        if (client.pupBrowser?.close) {
            await client.pupBrowser.close();
        }
    } catch (err) {
        console.warn(`Error force-closing browser: ${err.message}`);
    }
};

//get clinet by id
const getClient=(id)=>{
    const entry = clients.get(id.toString());
    return entry ? entry.client : null;
};

// get status of client

const getStatus=(userId)=>{
    const entry=clients.get(userId.toString());
    if(!entry){
        return 'disconnected';
    }
    return entry.status;
};

const resolvePuppeteerChrome = () => resolveChromeExecutable();

const resolveExecutablePath = () => {
    if (process.env.PUPPETEER_EXECUTABLE_PATH && fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
        return process.env.PUPPETEER_EXECUTABLE_PATH;
    }

    const puppeteerChrome = resolvePuppeteerChrome();
    if (puppeteerChrome) {
        return puppeteerChrome;
    }

    if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
        return process.env.CHROME_PATH;
    }

    if (process.env.EDGE_PATH && fs.existsSync(process.env.EDGE_PATH)) {
        return process.env.EDGE_PATH;
    }

    const platform = os.platform();
    const candidates = [];

    if (platform === 'win32') {
        candidates.push(
            'C:/Program Files/Google/Chrome/Application/chrome.exe',
            'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
            'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
            'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
        );
    }

    if (platform === 'darwin') {
        candidates.push(
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
        );
    }

    if (platform === 'linux') {
        candidates.push(
            '/usr/bin/google-chrome',
            '/usr/bin/google-chrome-stable',
            '/usr/bin/chromium',
            '/usr/bin/chromium-browser'
        );
    }

    return candidates.find(candidate => fs.existsSync(candidate)) || null;
};

const isPermanentDisconnectReason = (reason = '') =>
    ['LOGOUT', 'UNPAIRED', 'UNPAIRED_IDLE'].includes(String(reason).toUpperCase());

const markSessionLinked = async (userId, phoneNumber = null) => {
    await Session.findOneAndUpdate(
        { userId },
        {
            isActive: true,
            lastSeen: new Date(),
            ...(phoneNumber ? { phoneNumber } : {})
        },
        { upsert: true, returnDocument: 'after' }
    );
};

const markSessionUnlinked = async (userId) => {
    await Session.findOneAndUpdate(
        { userId },
        { isActive: false, phoneNumber: null, lastSeen: new Date() },
        { upsert: true }
    );
};

//create client

const createClient = async (userId, onQR, onReady, onDisconnected, options = {}) => {
    const { suppressQrNotification = false } = options;
    const userIdStr=userId.toString(); // ensure it's a string

    // Prevent duplicate client creation
    if(clientsBeingCreated.has(userIdStr)){
        console.log(`Client creation already in progress for user: ${userIdStr}`);
        const existing=clients.get(userIdStr);
        if(existing){
            // Wait for existing client to be ready
            return existing.client;
        }
        return null;
    }

    const existing=clients.get(userIdStr);
    if(existing && (existing.status==='connected' || existing.status==='pending')){
        console.log(`Client already exists for user: ${userIdStr} with status: ${existing.status}`);
        if(existing.status==='connected'){
            onReady();
            return existing.client;
        }

        // If pending for too long (> 60 seconds), destroy and create new
        if(existing.status==='pending' && existing.pendingStartTime){
            const pendingDuration = Date.now() - existing.pendingStartTime;
            if(pendingDuration > 60000){
                console.warn(`Client stuck in pending state for ${pendingDuration}ms, destroying and creating new`);
                await cleanupClient(existing.client);
                clients.delete(userIdStr);
                clientsBeingCreated.delete(userIdStr);
                // Fall through to create new client
            } else {
                // Still waiting, return existing
                return existing.client;
            }
        } else if(existing.status==='pending'){
            return existing.client;
        }
    }

    // If there's an old client, properly destroy it first
    if(existing && existing.client){
        try {
            console.log(`Destroying old client for user: ${userIdStr}`);
            await cleanupClient(existing.client);
            clients.delete(userIdStr);
        } catch(err){
            console.error(`Error destroying old client for user: ${userIdStr}:`, err.message);
            clients.delete(userIdStr);
        }
        // Small delay to allow browser to fully close
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    clientsBeingCreated.add(userIdStr);


    // Create new client with RemoteAuth (MongoDB-backed sessions, per user)
    const executablePath = resolveExecutablePath();
    if (executablePath) {
        console.log(`Using browser executable for user ${userIdStr}: ${executablePath}`);
    } else {
        console.warn(`No browser executable path found for user ${userIdStr}; falling back to puppeteer default`);
    }

    const client=new Client({
        authStrategy: new RemoteAuth({
            clientId: userIdStr,
            dataPath: AUTH_DATA_PATH,
            store: new FixedMongoStore({ mongoose, authDataPath: AUTH_DATA_PATH }),
            backupSyncIntervalMs: REMOTE_SESSION_BACKUP_MS
        }),
        puppeteer: getPuppeteerLaunchOptions(executablePath)
    });

    //store client and status
    clients.set(userIdStr,{client,status:'pending',pendingStartTime:Date.now()});

    // Add health check interval — periodically verify client is still alive
    const healthCheckInterval = setInterval(async () => {
        const entry = clients.get(userIdStr);
        if (entry && entry.status === 'connected') {
            try {
                // Check if browser process is still alive
                if (!client.pupBrowser || (client.pupBrowser.isClosed && client.pupBrowser.isClosed())) {
                    console.warn(`Health check failed for user: ${userIdStr} — browser closed`);
                    clearInterval(healthCheckInterval);
                    clients.delete(userIdStr);
                } else if (!client.pupPage || (client.pupPage.isClosed && client.pupPage.isClosed())) {
                    console.warn(`Health check failed for user: ${userIdStr} — page closed`);
                    clearInterval(healthCheckInterval);
                    clients.delete(userIdStr);
                }
            } catch (err) {
                console.error(`Health check error for user: ${userIdStr}`, err.message);
            }
        }
    }, 15000); // Check every 15 seconds (more frequent)

    // Clean up interval on client delete
    const originalCleanup = () => clearInterval(healthCheckInterval);
    client._healthCheckCleanup = originalCleanup;

    //qr code event
    //fires when whatsapp needs QR scan
    client.on('qr',async(qr)=>{
        console.log(`🔄 QR Code received for user: ${userIdStr}`);

        const qrEntry = clients.get(userIdStr);
        if (qrEntry?.qrTimeoutHandle) {
            clearTimeout(qrEntry.qrTimeoutHandle);
            qrEntry.qrTimeoutHandle = null;
        }

        if (suppressQrNotification) {
            const entry = clients.get(userIdStr);
            if (entry && !entry.recoveryQrGraceTimer) {
                console.log(
                    `ℹ️  QR during startup recovery for user: ${userIdStr} — waiting up to ${RECOVERY_QR_GRACE_MS / 1000}s for session restore`
                );
                entry.recoveryQrGraceTimer = setTimeout(async () => {
                    const current = clients.get(userIdStr);
                    if (!current || current.status === 'connected') return;

                    console.log(
                        `Stored session could not be recovered for user ${userIdStr}. Click Connect to scan QR.`
                    );
                    await abortPendingClient(userId, 'Recovery grace period elapsed after QR');
                }, RECOVERY_QR_GRACE_MS);
            }
            return;
        }
        try{
            const qrImage=await qrcode.toDataURL(qr);// convert QR code to image
            console.log(`✅ QR Code converted to data URL for user: ${userIdStr} (length: ${qrImage?.length || 0})`);
            console.log(`📤 Sending QR via onQR callback for user: ${userIdStr}`);
            onQR(qrImage);// send image to frontend via WebSocket
            console.log(`✅ QR callback executed for user: ${userIdStr}`);
        }catch(err){
            console.error(`QR code generation failed for user: ${userIdStr}`,err);
        }
    });
    

    //authianticated event
    //fires when qr scan successful
    // RemoteAuth persists the encrypted session in MongoDB
    client.on('authenticated', () => {
        console.log(`Client authenticated for user: ${userIdStr}`);
    });

    //remote session saved event
    client.on('remote_session_saved', async () => {
        console.log(`Remote session saved to MongoDB for user: ${userIdStr}`);
        await markSessionLinked(
            userId,
            client.info?.wid?.user ? `+${client.info.wid.user}` : null
        );
    });

    //ready event
    //fires when client is ready to send messages
    client.on('ready',async()=>{
        console.log(`Client ready for user: ${userIdStr}`);

        // Diagnostic logging - check what methods are actually available
        console.log(`Client properties check:
          - sendMessage type: ${typeof client.sendMessage}
          - pupPage exists: ${!!client.pupPage}
          - pupBrowser exists: ${!!client.pupBrowser}
          - hasOwnProperty sendMessage: ${client.hasOwnProperty('sendMessage')}
        `);

        //update status
        const entry=clients.get(userIdStr);
        if(entry){
            entry.status='connected';
            entry.pendingStartTime=null; // Clear pending timer
            if(entry.qrTimeoutHandle) clearTimeout(entry.qrTimeoutHandle);
            if(entry.recoveryQrGraceTimer){
                clearTimeout(entry.recoveryQrGraceTimer);
                entry.recoveryQrGraceTimer = null;
            }
        }

        await markSessionLinked(
            userId,
            client.info?.wid?.user ? `+${client.info.wid.user}` : null
        );

        onReady(); // notify frontend immediately — do not block on MongoDB backup
        scheduleSessionBackup(client, userIdStr, 20000);
    });

    client.on('message', async (msg) => {
        try {
            const { isAutoReplyEligibleMessage } = require('../utils/whatsappChat');
            if (!isAutoReplyEligibleMessage(msg)) return;

            const { handleIncomingMessage } = require('./autoReplyService');
            await handleIncomingMessage(client, userId, msg);
        } catch (err) {
            console.error(`Auto-reply error for user ${userIdStr}:`, err.message);
        }
    });

    //auth failure or disconnected event
    client.on('auth_failure',async(msg)=>{
        console.error(`Authentication failure for user: ${userIdStr}`,msg);

        // Clean up health check
        if (client._healthCheckCleanup) {
            client._healthCheckCleanup();
        }

        clients.delete(userIdStr); // remove client on auth failure
        clientsBeingCreated.delete(userIdStr);

        await markSessionUnlinked(userId);
        await deleteStoredRemoteSession(userId);
    });

    //disconnected

    client.on('disconnected',async(reason)=>{
        console.log(`Client disconnected for user: ${userIdStr}. Reason: ${reason}`);

        // Clean up health check
        if (client._healthCheckCleanup) {
            client._healthCheckCleanup();
        }

        clients.delete(userIdStr); // remove client on disconnect
        clientsBeingCreated.delete(userIdStr);

        if (isPermanentDisconnectReason(reason)) {
            await markSessionUnlinked(userId);
            await deleteStoredRemoteSession(userId);
        } else {
            cleanupLocalAuthArtifacts(userId);
        }

        onDisconnected(reason); // notify frontend
    });

    await withBrowserLaunchLock(async () => {
        await client.initialize();
    })
        .then(() => {
            clientsBeingCreated.delete(userIdStr);
        })
        .catch(async(err) => {
            if (isBrowserAlreadyRunningError(err)) {
                console.warn(`Browser lock detected for user: ${userIdStr}. Attempting recovery and retrying once.`);
                // Attempt to force-release any browser process and retry without touching local auth files
                await forceReleaseClient(client);
                clients.delete(userIdStr);
                clientsBeingCreated.delete(userIdStr);
                await sleep(3000);

                try {
                    const retryClient = await createClient(userId, onQR, onReady, onDisconnected);
                    return retryClient;
                } catch (retryErr) {
                    console.error(`Retry after browser lock failed for user: ${userIdStr}:`, retryErr.message);
                }

                await markSessionUnlinked(userId);
                onDisconnected(`WhatsApp browser failed to start after lock recovery: ${err.message}`);
                return;
            }

            console.error(`Client initialization failed for user: ${userIdStr}:`, err.message);
            const entry = clients.get(userIdStr);
            if(entry && entry.client === client){
                if(entry.qrTimeoutHandle) clearTimeout(entry.qrTimeoutHandle);
                await cleanupClient(client);
                clients.delete(userIdStr);
            }
            clientsBeingCreated.delete(userIdStr);
            onDisconnected(`WhatsApp browser failed to start: ${err.message}`);
        }); // start the client

    // Timeout if QR not received within the launch window
    const qrTimeoutHandle = setTimeout(() => {
        const entry = clients.get(userIdStr);
        if(entry && entry.status === 'pending'){
            console.warn(`⚠️  QR Code timeout for user: ${userIdStr} - no QR received in ${getQrTimeoutMs() / 1000} seconds`);
            console.warn(`This usually means the browser failed to load WhatsApp.com (check Render memory/plan)`);
        }
    }, getQrTimeoutMs());

    // Store timeout so we can clear it later
    if(clients.get(userIdStr)){
        clients.get(userIdStr).qrTimeoutHandle = qrTimeoutHandle;
    }

    // Handle initialization errors gracefully without blocking
    client.on('error', (err) => {
        console.error(`Client error for user: ${userIdStr}:`, err.message);
        // Don't crash - just log and handle gracefully
        if (err.message.includes('LifecycleWatcher') || err.message.includes('detached') || err.message.includes('Browser')) {
            console.log(`Browser crash detected for user: ${userIdStr}. Attempting recovery...`);
            const entry = clients.get(userIdStr);
            if (entry) {
                if (entry.client._healthCheckCleanup) {
                    entry.client._healthCheckCleanup();
                }
                clients.delete(userIdStr);
            }
            // Notify user to reconnect
            onDisconnected(`Browser crashed: ${err.message}`);
        }
    });

    return client;
};

// Tear down a stuck pending client (e.g. recovery that needs QR, or user clicked Connect again).
const abortPendingClient = async (userId, reason = 'Pending client aborted') => {
    const userIdStr = userId.toString();
    const entry = clients.get(userIdStr);

    if (!entry) {
        clientsBeingCreated.delete(userIdStr);
        return false;
    }

    console.log(`Aborting WhatsApp client for user ${userIdStr}: ${reason}`);

    if (entry.qrTimeoutHandle) clearTimeout(entry.qrTimeoutHandle);
    if (entry.recoveryQrGraceTimer) clearTimeout(entry.recoveryQrGraceTimer);
    if (entry.sessionBackupTimer) clearTimeout(entry.sessionBackupTimer);
    if (entry.client?._healthCheckCleanup) {
        entry.client._healthCheckCleanup();
    }

    try {
        await cleanupClient(entry.client);
    } catch (err) {
        console.warn(`Error aborting client for user ${userIdStr}: ${err.message}`);
    }

    clients.delete(userIdStr);
    clientsBeingCreated.delete(userIdStr);
    return true;
};

// Stop the in-memory browser but keep the stored WhatsApp session for reconnect.
const disconnectClient=async(userId)=>{
    const userIdStr=userId.toString();
    const entry=clients.get(userIdStr);

    if(entry){
        try{
            // Clean up health check interval
            if (entry.client._healthCheckCleanup) {
                entry.client._healthCheckCleanup();
            }

            // Destroy client without logging out — preserves RemoteAuth session
            await cleanupClient(entry.client);

        }catch(err){
            console.error(`Error disconnecting client for user: ${userIdStr}`,err);
        }
        clients.delete(userIdStr); // remove from map
    }

    clientsBeingCreated.delete(userIdStr);

    cleanupLocalAuthArtifacts(userId);

    console.log(`Client disconnected for user: ${userIdStr} (MongoDB session preserved)`);
};

const clearWhatsAppSession = async (userId) => {
    const userIdStr = userId.toString();
    const entry = clients.get(userIdStr);

    if (entry?.client) {
        try {
            if (entry.client._healthCheckCleanup) {
                entry.client._healthCheckCleanup();
            }
            await entry.client.logout();
        } catch (err) {
            console.warn(`WhatsApp logout failed for user ${userIdStr}: ${err.message}`);
            await deleteStoredRemoteSession(userId);
            await cleanupClient(entry.client);
        }
    } else {
        await deleteStoredRemoteSession(userId);
    }

    clients.delete(userIdStr);
    clientsBeingCreated.delete(userIdStr);
    await markSessionUnlinked(userId);

    console.log(`WhatsApp session cleared for user: ${userIdStr}`);
};

const ensureClientConnected = async (userId, sendToUser) => {
    const userIdStr = userId.toString();

    if (isClientReady(userId)) {
        return getClient(userId);
    }

    if (clientsBeingCreated.has(userIdStr) || getStatus(userId) === 'pending') {
        return null;
    }

    if (!(await canRecoverSession(userId))) {
        return null;
    }

    return createClient(
        userId,
        () => {
            console.log(`Stored session expired for user ${userIdStr}. QR required via Connect.`);
        },
        () => {
            sendToUser?.(userIdStr, { type: 'ready' });
        },
        () => {},
        { suppressQrNotification: true }
    );
};


//recover sessions on backend startup
const recoverSessions=async(sendToUser)=>{
    try {
        if (process.env.SKIP_SESSION_RECOVERY === 'true') {
            console.log('Skipping WhatsApp session recovery (SKIP_SESSION_RECOVERY=true)');
            return;
        }

        console.log('🔄 Attempting to recover active sessions from database...');
        const activeSessions = await Session.find({ isActive: true });

        if (activeSessions.length === 0) {
            console.log('No active sessions to recover');
            return;
        }

        console.log(`Found ${activeSessions.length} active sessions to recover`);

        const recoveryDelayMs = isProductionLinux() ? 8000 : 2000;

        for (const session of activeSessions) {
            try {
                const userId = session.userId;
                const recoverable = await canRecoverSession(userId);

                if (!recoverable) {
                    console.warn(`No recoverable WhatsApp session for user ${userId}. Skipping recovery.`);
                    await markSessionUnlinked(userId);
                    continue;
                }

                console.log(`Recovering session for user: ${userId}`);

                await createClient(
                    userId,
                    () => {
                        console.log(`⚠️  Stored session expired for user: ${userId}. User must click Connect to scan QR.`);
                    },
                    () => {
                        console.log(`✅ Session recovered for user: ${userId}`);
                        sendToUser(userId.toString(), { type: 'ready' });
                    },
                    (reason) => {
                        console.log(`Session recovery failed for user: ${userId}: ${reason}`);
                    },
                    { suppressQrNotification: true }
                );

                if (isProductionLinux()) {
                    console.log(`Waiting ${recoveryDelayMs / 1000}s before next session recovery (Render memory limit)`);
                    await sleep(recoveryDelayMs);
                }
            } catch (err) {
                console.error(`Error recovering session for user ${session.userId}:`, err.message);
            }
        }
    } catch (err) {
        console.error('Error during session recovery:', err);
    }
};

module.exports={
    createClient,
    getClient,
    getStatus,
    isClientReady,
    waitForClientReady,
    ensureClientConnected,
    abortPendingClient,
    disconnectClient,
    clearWhatsAppSession,
    recoverSessions,
    canRecoverSession,
    cleanupLocalAuthArtifacts
};
