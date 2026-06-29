const fs = require('fs');
const path = require('path');
const pino = require('pino');
const qrcode = require('qrcode');
const {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const Session = require('../models/Session');
const {
  AUTH_DATA_PATH,
  canRecoverSession,
  cleanupLocalAuthArtifacts,
  deleteStoredRemoteSession,
  listLocalSessionUserIds,
  getLocalSessionDir
} = require('../utils/whatsappSession');
const {
  createBaileysClientAdapter,
  wrapIncomingMessage,
  upsertChatRecord,
  upsertContactRecord,
  getChatsForPicker,
  hasPickerCandidates,
  normalizeJid,
  buildLidPhoneMap,
  resolveLidPhonesViaUsync,
  collectRecentUnresolvedLids,
  syncContactToChatMap
} = require('../utils/baileysAdapter');

const clients = new Map();
const clientsBeingCreated = new Set();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const silentLogger = pino({ level: 'silent' });

const releaseBufferedBaileysEvents = async (entry) => {
  if (!entry?.sock?.ev?.flush) return;

  try {
    entry.sock.ev.flush(true);
    await sleep(300);
  } catch (err) {
    console.warn(`Baileys event flush failed: ${err.message}`);
  }
};

const getQrTimeoutMs = (isRecovery = false) => (isRecovery ? 180000 : 120000);

const isClientReady = (userId) => {
  const entry = clients.get(userId.toString());
  return Boolean(entry?.client && entry.status === 'connected' && entry.client.sendMessage);
};

const isClientPending = (userId) => {
  const entry = clients.get(userId.toString());
  return Boolean(entry && (entry.status === 'pending' || clientsBeingCreated.has(userId.toString())));
};

const waitForClientReady = async (userId, maxMs = 20000) => {
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    if (isClientReady(userId)) return getClient(userId);
    await sleep(500);
  }
  return null;
};

const getClient = (id) => {
  const entry = clients.get(id.toString());
  return entry ? entry.client : null;
};

const getStatus = (userId) => {
  const entry = clients.get(userId.toString());
  if (!entry) return 'disconnected';
  return entry.status;
};

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

const clearStaleStoredSession = async (userId) => {
  await deleteStoredRemoteSession(userId);
  await markSessionUnlinked(userId);
};

const cleanupEntry = async (entry) => {
  if (!entry) return;

  entry.shouldStayClosed = true;

  if (entry.qrTimeoutHandle) clearTimeout(entry.qrTimeoutHandle);
  if (entry.client?._healthCheckCleanup) entry.client._healthCheckCleanup();

  try {
    await entry.client?.end?.();
  } catch {
    // ignore
  }
};

const bindSocketEvents = ({
  sock,
  userId,
  userIdStr,
  entry,
  onQR,
  onReady,
  onDisconnected,
  suppressQrNotification
}) => {
  sock.ev.on('creds.update', entry.saveCreds);

  sock.ev.on('chats.set', ({ chats = [] }) => {
    chats.forEach((chat) => upsertChatRecord(entry.chatMap, chat));
  });

  sock.ev.on('chats.upsert', (chats = []) => {
    chats.forEach((chat) => upsertChatRecord(entry.chatMap, chat));
  });

  sock.ev.on('chats.update', (updates = []) => {
    updates.forEach((update) => {
      const id = normalizeJid(update.id);
      if (!id) return;
      upsertChatRecord(entry.chatMap, { ...entry.chatMap.get(id), ...update, id });
    });
  });

  sock.ev.on('contacts.set', ({ contacts = [] }) => {
    if (contacts.length > 0) entry.pickerDirty = true;
    contacts.forEach((contact) => {
      upsertContactRecord(entry.contactMap, contact);
      syncContactToChatMap(entry.chatMap, contact);
    });
  });

  sock.ev.on('contacts.upsert', (contacts = []) => {
    if (contacts.length > 0) entry.pickerDirty = true;
    contacts.forEach((contact) => {
      upsertContactRecord(entry.contactMap, contact);
      syncContactToChatMap(entry.chatMap, contact);
    });
  });

  sock.ev.on('contacts.update', (updates = []) => {
    updates.forEach((update) => {
      const id = normalizeJid(update.id);
      if (!id) return;
      const merged = { ...entry.contactMap.get(id), ...update, id };
      upsertContactRecord(entry.contactMap, merged);
      syncContactToChatMap(entry.chatMap, merged);
    });
  });

  sock.ev.on('messaging-history.set', ({ chats = [], contacts = [] }) => {
    if (chats.length > 0 || contacts.length > 0) entry.pickerDirty = true;
    chats.forEach((chat) => upsertChatRecord(entry.chatMap, chat));
    contacts.forEach((contact) => {
      upsertContactRecord(entry.contactMap, contact);
      syncContactToChatMap(entry.chatMap, contact);
    });
  });

  sock.ev.on('chats.phoneNumberShare', ({ lid, jid }) => {
    const { resolvePhoneFromChatId } = require('../utils/whatsappChat');
    const lidNorm = normalizeJid(lid);
    const phone = resolvePhoneFromChatId(normalizeJid(jid)) || resolvePhoneFromChatId(jid);
    if (lidNorm && phone) {
      entry.lidPhoneMap.set(lidNorm, phone);
      entry.pickerDirty = true;
    }
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      entry.qrReceived = true;
      if (entry.qrTimeoutHandle) {
        clearTimeout(entry.qrTimeoutHandle);
        entry.qrTimeoutHandle = null;
      }

      if (entry.suppressQrNotification) {
        console.log(`Stale Baileys session for ${userIdStr} — clearing and showing QR`);
        await clearStaleStoredSession(userId);
        entry.suppressQrNotification = false;
      }

      try {
        const qrImage = await qrcode.toDataURL(qr);
        onQR(qrImage);
      } catch (err) {
        console.error(`QR generation failed for ${userIdStr}:`, err.message);
      }
    }

    if (connection === 'open') {
      entry.status = 'connected';
      entry.pendingStartTime = null;
      if (entry.qrTimeoutHandle) clearTimeout(entry.qrTimeoutHandle);

      const phone = sock.user?.id ? `+${String(sock.user.id).split('@')[0]}` : null;
      await markSessionLinked(userId, phone);
      onReady();

      setTimeout(() => {
        releaseBufferedBaileysEvents(entry).catch(() => {});
        prewarmPickerCache(userId);
      }, 2500);
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;
      const reason = lastDisconnect?.error?.message || 'Connection closed';

      clients.delete(userIdStr);
      clientsBeingCreated.delete(userIdStr);

      if (loggedOut) {
        await markSessionUnlinked(userId);
        await deleteStoredRemoteSession(userId);
      }

      if (!entry.shouldStayClosed && !loggedOut && entry.allowReconnect) {
        console.log(`Baileys reconnecting user ${userIdStr}...`);
        setTimeout(() => {
          createClient(userId, onQR, onReady, onDisconnected, {
            suppressQrNotification: entry.suppressQrNotification,
            freshAuth: false
          }).catch((err) => console.error(`Reconnect failed for ${userIdStr}:`, err.message));
        }, 3000);
        return;
      }

      onDisconnected(reason);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages = [], type }) => {
    if (type !== 'notify') return;

    const current = clients.get(userIdStr);
    if (!current || current.status !== 'connected') return;

    for (const waMessage of messages) {
      try {
        const chatId = normalizeJid(waMessage?.key?.remoteJid);
        if (chatId) {
          upsertChatRecord(entry.chatMap, {
            id: chatId,
            conversationTimestamp: waMessage.messageTimestamp,
            pushName: waMessage.pushName
          });
        }

        const { isAutoReplyEligibleMessage } = require('../utils/whatsappChat');
        const wrapped = wrapIncomingMessage(sock, waMessage, entry.contactMap);
        if (!isAutoReplyEligibleMessage(wrapped)) continue;

        const { handleIncomingMessage } = require('./autoReplyService');
        await handleIncomingMessage(current.client, userId, wrapped);
      } catch (err) {
        console.error(`Auto-reply error for user ${userIdStr}:`, err.message);
      }
    }
  });
};

const createClient = async (userId, onQR, onReady, onDisconnected, options = {}) => {
  const {
    suppressQrNotification = false,
    freshAuth = false,
    initRetry = false
  } = options;
  const userIdStr = userId.toString();

  if (freshAuth && !initRetry) {
    const existingEntry = clients.get(userIdStr);
    if (existingEntry) await cleanupEntry(existingEntry);
    clients.delete(userIdStr);
    clientsBeingCreated.delete(userIdStr);
    await deleteStoredRemoteSession(userId);
    await markSessionUnlinked(userId);
    await sleep(500);
  }

  if (clientsBeingCreated.has(userIdStr)) {
    const existing = clients.get(userIdStr);
    return existing?.client || null;
  }

  const existing = clients.get(userIdStr);
  if (existing?.status === 'connected') {
    onReady();
    return existing.client;
  }

  if (existing?.status === 'pending') {
    const pendingDuration = Date.now() - (existing.pendingStartTime || 0);
    if (pendingDuration < 60000) return existing.client;
    await cleanupEntry(existing);
    clients.delete(userIdStr);
  } else if (existing?.client) {
    await cleanupEntry(existing);
    clients.delete(userIdStr);
    await sleep(500);
  }

  clientsBeingCreated.add(userIdStr);

  const sessionDir = getLocalSessionDir(userId);
  fs.mkdirSync(sessionDir, { recursive: true });
  console.log(`Using Baileys session storage: ${sessionDir}`);

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const { version } = await fetchLatestBaileysVersion();

  const chatMap = new Map();
  const contactMap = new Map();
  const lidPhoneMap = new Map();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: silentLogger,
    browser: ['WA Auto Reply', 'Chrome', '1.0.0'],
    syncFullHistory: true,
    markOnlineOnConnect: false,
    shouldSyncHistoryMessage: () => true
  });

  const client = createBaileysClientAdapter(sock, { chatMap, contactMap });

  const entry = {
    client,
    sock,
    status: 'pending',
    pendingStartTime: Date.now(),
    qrReceived: false,
    shouldStayClosed: false,
    allowReconnect: true,
    suppressQrNotification,
    saveCreds,
    chatMap,
    contactMap,
    lidPhoneMap,
    pickerDirty: false,
    qrTimeoutHandle: null
  };

  entry.qrTimeoutHandle = setTimeout(async () => {
    const live = clients.get(userIdStr);
    if (!live || live.status !== 'pending' || live.qrReceived) return;

    console.warn(`QR timeout for user ${userIdStr}`);

    if (entry.suppressQrNotification) {
      await clearStaleStoredSession(userId);
      await abortPendingClient(userId, 'Recovery timed out waiting for session restore');
      return;
    }

    onDisconnected('WhatsApp took too long to show QR. Click Re-generate QR to try again.');
  }, getQrTimeoutMs(suppressQrNotification));

  clients.set(userIdStr, entry);

  bindSocketEvents({
    sock,
    userId,
    userIdStr,
    entry,
    onQR,
    onReady,
    onDisconnected,
    suppressQrNotification
  });

  clientsBeingCreated.delete(userIdStr);
  return client;
};

const abortPendingClient = async (userId, reason = 'Pending client aborted') => {
  const userIdStr = userId.toString();
  const entry = clients.get(userIdStr);

  if (!entry) {
    clientsBeingCreated.delete(userIdStr);
    return false;
  }

  console.log(`Aborting Baileys client for user ${userIdStr}: ${reason}`);
  await cleanupEntry(entry);
  clients.delete(userIdStr);
  clientsBeingCreated.delete(userIdStr);
  await sleep(500);
  return true;
};

const disconnectClient = async (userId) => {
  const userIdStr = userId.toString();
  const entry = clients.get(userIdStr);

  if (entry) {
    entry.allowReconnect = false;
    await cleanupEntry(entry);
    clients.delete(userIdStr);
  }

  clientsBeingCreated.delete(userIdStr);
  console.log(`Baileys client disconnected for user ${userIdStr} (session preserved)`);
};

const clearWhatsAppSession = async (userId) => {
  const userIdStr = userId.toString();
  const entry = clients.get(userIdStr);

  if (entry) {
    entry.allowReconnect = false;
    try {
      await entry.sock?.logout?.();
    } catch {
      // ignore
    }
    await cleanupEntry(entry);
    clients.delete(userIdStr);
  }

  clientsBeingCreated.delete(userIdStr);
  await sleep(1000);
  await cleanupLocalAuthArtifacts(userId);
  await markSessionUnlinked(userId);
  console.log(`Baileys session cleared for user: ${userIdStr}`);
};

const ensureClientConnected = async (userId, sendToUser) => {
  const userIdStr = userId.toString();

  if (isClientReady(userId)) return getClient(userId);
  if (clientsBeingCreated.has(userIdStr) || getStatus(userId) === 'pending') return null;
  if (!(await canRecoverSession(userId))) return null;

  return createClient(
    userId,
    (qrImage) => sendToUser?.(userIdStr, { type: 'qr', qr: qrImage }),
    () => sendToUser?.(userIdStr, { type: 'ready' }),
    (reason) => sendToUser?.(userIdStr, { type: 'disconnected', reason }),
    { suppressQrNotification: true }
  );
};

const withPickerTimeout = async (promise, ms, label = 'picker task') => {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
};

const waitForChatHydration = async (entry, maxMs = 2000) => {
  if (!entry) return false;
  if (hasPickerCandidates(entry.chatMap, entry.contactMap)) return true;

  return new Promise((resolve) => {
    const onHydrate = () => {
      if (hasPickerCandidates(entry.chatMap, entry.contactMap)) {
        cleanup();
        resolve(true);
      }
    };

    const timer = setTimeout(() => {
      cleanup();
      resolve(hasPickerCandidates(entry.chatMap, entry.contactMap));
    }, maxMs);

    const cleanup = () => {
      clearTimeout(timer);
      entry.sock?.ev?.off('chats.upsert', onHydrate);
      entry.sock?.ev?.off('chats.update', onHydrate);
      entry.sock?.ev?.off('messaging-history.set', onHydrate);
      entry.sock?.ev?.off('contacts.upsert', onHydrate);
      entry.sock?.ev?.off('contacts.update', onHydrate);
    };

    entry.sock?.ev?.on('chats.upsert', onHydrate);
    entry.sock?.ev?.on('chats.update', onHydrate);
    entry.sock?.ev?.on('messaging-history.set', onHydrate);
    entry.sock?.ev?.on('contacts.upsert', onHydrate);
    entry.sock?.ev?.on('contacts.update', onHydrate);
  });
};

const hydratePickerMaps = async (entry, { maxWaitMs = 2000, allowResync = false } = {}) => {
  if (!entry) return;

  await releaseBufferedBaileysEvents(entry);
  if (hasPickerCandidates(entry.chatMap, entry.contactMap)) return;

  if (
    allowResync &&
    entry.chatMap.size === 0 &&
    entry.contactMap.size === 0 &&
    typeof entry.sock?.resyncAppState === 'function'
  ) {
    try {
      const { ALL_WA_PATCH_NAMES } = require('@whiskeysockets/baileys/lib/Types/Chat');
      await withPickerTimeout(
        entry.sock.resyncAppState(ALL_WA_PATCH_NAMES, false),
        8000,
        'app-state resync'
      );
      await releaseBufferedBaileysEvents(entry);
    } catch (err) {
      console.warn(`Baileys app-state resync skipped: ${err.message}`);
    }
  }

  if (!hasPickerCandidates(entry.chatMap, entry.contactMap)) {
    await waitForChatHydration(entry, maxWaitMs);
    await releaseBufferedBaileysEvents(entry);
  }
};

const pickerCache = new Map();
const PICKER_CACHE_TTL_MS = 120000;
let prewarmPickerCache = () => {};

const { getRecentChatsFromDb } = require('../utils/whatsappChat');

const getPickerContacts = async (userId, { limit = 200, forceRefresh = false } = {}) => {
  const userIdStr = userId.toString();
  const cacheKey = `${userIdStr}:${limit}`;
  const started = Date.now();

  if (forceRefresh) {
    pickerCache.delete(cacheKey);
  }

  const cached = pickerCache.get(cacheKey);

  if (!forceRefresh && cached && Date.now() - cached.at < PICKER_CACHE_TTL_MS) {
    return cached.contacts;
  }

  let client = getClient(userId);
  if (!isClientReady(userId)) {
    client = await waitForClientReady(userId, 8000);
  }

  if (!client || !isClientReady(userId)) {
    throw new Error('WhatsApp not connected. Connect first, then click Refresh.');
  }

  const entry = clients.get(userIdStr);
  if (entry?.pickerDirty) {
    pickerCache.delete(cacheKey);
    entry.pickerDirty = false;
  }

  await releaseBufferedBaileysEvents(entry);

  const hasInMemoryData = entry.chatMap.size > 0 || entry.contactMap.size > 0;
  if (!hasInMemoryData || forceRefresh) {
    await hydratePickerMaps(entry, {
      maxWaitMs: forceRefresh ? 5000 : 2000,
      allowResync: forceRefresh
    });
  }

  let lidPhoneMap = buildLidPhoneMap(entry.contactMap, entry.lidPhoneMap);
  const selfDigits = String(entry.sock?.user?.id || '').split('@')[0] || '';

  const buildContacts = () =>
    getChatsForPicker(entry.chatMap, entry.contactMap, {
      limit,
      lidPhoneMap,
      excludePhoneDigits: selfDigits
    });

  let contacts = buildContacts();

  const maxLidLookup = forceRefresh ? 80 : 40;
  const unresolvedLids = collectRecentUnresolvedLids(entry.chatMap, lidPhoneMap, maxLidLookup);

  if (unresolvedLids.length > 0 && entry.sock) {
    try {
      const resolved = await withPickerTimeout(
        resolveLidPhonesViaUsync(entry.sock, unresolvedLids, {
          batchSize: 10,
          maxLids: maxLidLookup
        }),
        forceRefresh ? 10000 : 6000,
        'LID phone lookup'
      );
      resolved.forEach((phone, lid) => {
        lidPhoneMap.set(lid, phone);
        entry.lidPhoneMap.set(lid, phone);
      });
      contacts = buildContacts();
    } catch (err) {
      console.warn(`LID phone lookup skipped: ${err.message}`);
    }
  }

  console.log(
    `Picker maps for ${userIdStr}: chats=${entry.chatMap.size}, contacts=${entry.contactMap.size}, lidMap=${lidPhoneMap.size}, picked=${contacts.length} in ${Date.now() - started}ms`
  );

  if (contacts.length === 0) {
    contacts = await getRecentChatsFromDb(userId, { limit });
    console.log(`Picker DB fallback for ${userIdStr}: ${contacts.length} contacts`);
  }

  if (contacts.length > 0) {
    pickerCache.set(cacheKey, { contacts, at: Date.now() });
  }

  return contacts;
};

prewarmPickerCache = (userId) => {
  getPickerContacts(userId, { limit: 200, forceRefresh: false }).catch(() => {});
};

const recoverSessions = async (sendToUser) => {
  try {
    if (process.env.SKIP_SESSION_RECOVERY === 'true') {
      console.log('Skipping WhatsApp session recovery (SKIP_SESSION_RECOVERY=true)');
      return;
    }

    const activeSessions = await Session.find({ isActive: true }).select('userId').lean();
    const localUserIds = listLocalSessionUserIds();
    const userIds = new Set([
      ...activeSessions.map((session) => session.userId.toString()),
      ...localUserIds
    ]);

    if (userIds.size === 0) {
      console.log('No stored Baileys sessions to restore on startup');
      return;
    }

    console.log(`Restoring ${userIds.size} Baileys session(s) on startup...`);

    for (const userIdStr of userIds) {
      if (isClientReady(userIdStr) || isClientPending(userIdStr)) continue;
      if (!(await canRecoverSession(userIdStr))) continue;

      try {
        await ensureClientConnected(userIdStr, sendToUser);
        await sleep(3000);
      } catch (err) {
        console.error(`Failed to restore session for ${userIdStr}:`, err.message);
      }
    }
  } catch (err) {
    console.error('Error during session recovery:', err);
  }
};

module.exports = {
  createClient,
  getClient,
  getStatus,
  isClientReady,
  isClientPending,
  waitForClientReady,
  getPickerContacts,
  ensureClientConnected,
  abortPendingClient,
  disconnectClient,
  clearWhatsAppSession,
  recoverSessions,
  canRecoverSession,
  cleanupLocalAuthArtifacts,
  AUTH_DATA_PATH
};
