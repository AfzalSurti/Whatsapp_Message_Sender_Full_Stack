const {Client, RemoteAuth} = require('whatsapp-web.js');
const {MongoStore} = require('wwebjs-mongo');
const mongoose = require('mongoose');
const fs = require('fs');
const os = require('os');
const qrcode = require('qrcode');
const Session = require('../models/Session');
const { resolveChromeExecutable } = require('../config/puppeteerEnv');

//client store
const clients=new Map();
// Track clients being created to prevent duplicates
const clientsBeingCreated = new Set();

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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

//create client

const createClient=async(userId,onQR,onReady,onDisconnected)=>{
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
            store: new MongoStore({ mongoose }),
            backupSyncIntervalMs: 300000
        }),
        puppeteer:{
            headless:true,
            executablePath: executablePath || undefined,
            args:[
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-web-resources',
                '--disable-default-apps',
                '--disable-popup-blocking',
                '--no-zygote',
                '--disable-software-rasterizer'
            ]
        }
    });

    //store client and status
    clients.set(userIdStr,{client,status:'pending',pendingStartTime:Date.now()});

    // Ensure the session is marked active as soon as initialization starts,
    // so restart recovery can find it even if the process restarts before ready.
    await Session.findOneAndUpdate(
        {userId},
        {isActive:true,lastSeen:new Date()},
        {upsert:true,returnDocument:'after'}
    );

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
                    onDisconnected('Browser process ended');
                }
                // Simple health check — verify client is still responsive
                if (!client.pupPage || (client.pupPage.isClosed && client.pupPage.isClosed())) {
                    console.warn(`Health check failed for user: ${userIdStr} — page closed`);
                    clearInterval(healthCheckInterval);
                    clients.delete(userIdStr);
                    onDisconnected('Browser page closed');
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
    client.on('authenticated',()=>{
        console.log(`Client authenticated for user: ${userIdStr}`);
    });

    //remote session saved event
    client.on('remote_session_saved',()=>{
        console.log(`Remote session saved for user: ${userIdStr}`);
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
        }

        await Session.findOneAndUpdate(
            {userId},
            {isActive:true,lastSeen:new Date()},
            {upsert:true,returnDocument:'after'}
        );

        onReady(); // notify frontend
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

        // Keep the session record active so a restart can recover it.
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

        // Do not mark inactive here; a browser disconnect can be temporary and
        // the RemoteAuth session may still be recoverable on restart.
        onDisconnected(reason); // notify frontend
    });

    client.initialize()
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

                await Session.findOneAndUpdate(
                    {userId},
                    {isActive:false},
                    {upsert:true}
                );
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
            await Session.findOneAndUpdate(
                {userId},
                {isActive:false},
                {upsert:true}
            );
            onDisconnected(`WhatsApp browser failed to start: ${err.message}`);
        }); // start the client

    // Timeout if QR not received within 30 seconds
    const qrTimeoutHandle = setTimeout(() => {
        const entry = clients.get(userIdStr);
        if(entry && entry.status === 'pending'){
            console.warn(`⚠️  QR Code timeout for user: ${userIdStr} - no QR received in 30 seconds`);
            console.warn(`This usually means the browser failed to load WhatsApp.com`);
        }
    }, 30000);

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

//disconnect client
const disconnectClient=async(userId)=>{
    const userIdStr=userId.toString();
    const entry=clients.get(userIdStr);

    if(entry){
        try{
            // Clean up health check interval
            if (entry.client._healthCheckCleanup) {
                entry.client._healthCheckCleanup();
            }

            // Destroy client without logging out — preserves session for recovery
            await cleanupClient(entry.client);

        }catch(err){
            console.error(`Error disconnecting client for user: ${userIdStr}`,err);
        }
        clients.delete(userIdStr); // remove from map

        await Session.findOneAndUpdate(
            {userId},
            {isActive:false,lastSeen:new Date()},
            {upsert:true}
        );
    }

    clientsBeingCreated.delete(userIdStr);

    console.log(`Client disconnected for user: ${userIdStr}`);
};


//recover sessions on backend startup
const recoverSessions=async(sendToUser)=>{
    try {
        console.log('🔄 Attempting to recover active sessions from database...');
        const activeSessions = await Session.find({ isActive: true });

        if (activeSessions.length === 0) {
            console.log('No active sessions to recover');
            return;
        }

        console.log(`Found ${activeSessions.length} active sessions to recover`);

        for (const session of activeSessions) {
            try {
                const userId = session.userId;
                console.log(`Recovering session for user: ${userId}`);

                // Try to create client silently (no new QR generation)
                // Only used for existing authenticated sessions
                await createClient(
                    userId,
                    (qrImage) => {
                        // Only notify if recovery failed and QR is needed
                        console.log(`⚠️  QR regeneration needed for user: ${userId}`);
                        sendToUser(userId.toString(), { type: 'qr', qr: qrImage });
                    },
                    () => {
                        console.log(`✅ Session recovered for user: ${userId}`);
                        sendToUser(userId.toString(), { type: 'ready' });
                    },
                    (reason) => {
                        console.log(`Session recovery failed for user: ${userId}: ${reason}`);
                        sendToUser(userId.toString(), { type: 'disconnected', reason });
                    }
                );
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
    disconnectClient,
    recoverSessions
};
