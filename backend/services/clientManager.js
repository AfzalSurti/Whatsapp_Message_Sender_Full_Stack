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
const { makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys/lib/Utils/auth-utils');
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
  normalizeJid,
  buildLidPhoneMap,
  resolveLidPhonesViaUsync,
  collectRecentUnresolvedLids,
  syncContactToChatMap
} = require('../utils/baileysAdapter');
const {
  upsertContactPickerRecord,
  contactsFromPickerStore
} = require('../utils/contactPickerStore');
const { parseConnectedPhoneFromJid } = require('../utils/whatsappChat');
const { ensureDefaultSchedulerAlertPhone } = require('../utils/schedulerReminder');

const clients = new Map();
const clientsBeingCreated = new Set();
const reconnectAttemptsByUser = new Map();
const pendingAutoReconnect = new Set();
const MAX_AUTO_RECONNECTS = 12;
const ALL_WA_PATCH_NAMES = [
  'critical_block',
  'critical_unblock_low',
  'regular_high',
  'regular_low',
  'regular'
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const silentLogger = pino({ level: 'silent' });

const releaseBufferedBaileysEvents = async (entry) => {
  if (!entry?.sock?.ev?.flush) return;

  try {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const isBuffering = entry.sock.ev.isBuffering?.() ?? false;
      entry.sock.ev.flush(true);
      await sleep(isBuffering ? 500 : 250);
      if (!entry.sock.ev.isBuffering?.()) break;
    }
  } catch (err) {
    console.warn(`Baileys event flush failed: ${err.message}`);
  }
};

const ingestContact = (entry, contact) => {
  if (!contact) return;
  upsertContactRecord(entry.contactMap, contact);
  upsertContactPickerRecord(entry.contactStore, contact);
  syncContactToChatMap(entry.chatMap, contact);
};

const ingestContacts = (entry, contacts = []) => {
  if (contacts.length > 0) {
    console.log(`contacts batch for user: +${contacts.length} (store will be ${entry.contactStore.size + contacts.length})`);
  }
  contacts.forEach((contact) => ingestContact(entry, contact));
};

const MIN_EXPECTED_CONTACTS = 50;
const DEFAULT_TARGET_CONTACTS = 180;

const countContactEntries = (entry) => {
  if (!entry) return 0;
  return Math.max(
    entry.contactStore?.size || 0,
    entry.contactMap?.size || 0,
    entry.chatMap?.size || 0
  );
};

const hasContactData = (entry) => countContactEntries(entry) > 0;

const needsFullContactSync = (
  entry,
  { minExpected = MIN_EXPECTED_CONTACTS } = {}
) => countContactEntries(entry) < minExpected;

const requestOnDemandHistorySync = async (entry, { maxWaitMs = 45000, rounds = 5 } = {}) => {
  const sock = entry?.sock;
  if (!sock?.fetchMessageHistory) return false;

  const creds = sock.authState?.creds;
  const anchors = (creds?.processedHistoryMessages || []).slice(0, rounds);
  if (anchors.length === 0) {
    console.warn('On-demand history sync skipped: no history anchors in session');
    return false;
  }

  let batchCount = 0;
  const historyPromise = new Promise((resolve) => {
    const onHistory = (payload) => {
      const chatCount = payload?.chats?.length || 0;
      const contactCount = payload?.contacts?.length || 0;
      if (chatCount + contactCount > 0) {
        batchCount += 1;
        console.log(
          `History batch ${batchCount}: +${chatCount} chats, +${contactCount} contacts (maps=${countContactEntries(entry)})`
        );
      }
    };

    const timer = setTimeout(() => {
      cleanup();
      resolve(batchCount > 0);
    }, maxWaitMs);

    const cleanup = () => {
      clearTimeout(timer);
      sock.ev?.off('messaging-history.set', onHistory);
    };

    sock.ev?.on('messaging-history.set', onHistory);
  });

  try {
    console.log(`Requesting on-demand history sync (${anchors.length} anchor(s))...`);
    for (let i = 0; i < anchors.length; i += 1) {
      const anchor = anchors[i];
      if (!anchor?.key) continue;
      try {
        await sock.fetchMessageHistory(500, anchor.key, anchor.messageTimestamp);
        await releaseBufferedBaileysEvents(entry);
        if (i < anchors.length - 1) await sleep(1500);
      } catch (err) {
        console.warn(`History sync anchor ${i + 1} failed: ${err.message}`);
      }
    }
    const received = await historyPromise;
    await releaseBufferedBaileysEvents(entry);
    return received;
  } catch (err) {
    console.warn(`On-demand history sync failed: ${err.message}`);
    return false;
  }
};

const forceSyncWhatsAppContacts = async (
  entry,
  { maxWaitMs = 30000, force = false, minExpected = MIN_EXPECTED_CONTACTS } = {}
) => {
  if (!entry?.sock || entry.status !== 'connected') return false;

  await releaseBufferedBaileysEvents(entry);
  if (!needsFullContactSync(entry, { minExpected })) return true;

  if (typeof entry.sock.resyncAppState === 'function') {
    try {
      if (force && entry.sock.authState?.keys?.set) {
        console.log('Resetting app-state sync versions for full contact snapshot...');
        for (const name of ALL_WA_PATCH_NAMES) {
          await entry.sock.authState.keys.set({ 'app-state-sync-version': { [name]: null } });
        }
      }
      const keyId = entry.sock.authState?.creds?.myAppStateKeyId || 'missing';
      console.log(`Running app-state resync (force=${force}, keyId=${keyId})...`);
      await withPickerTimeout(
        entry.sock.resyncAppState(ALL_WA_PATCH_NAMES, force),
        force ? 35000 : 25000,
        'app-state resync'
      );
      await releaseBufferedBaileysEvents(entry);
    } catch (err) {
      console.warn(`App-state resync failed: ${err.message}`);
    }
  }

  if (needsFullContactSync(entry, { minExpected })) {
    await requestOnDemandHistorySync(entry, {
      maxWaitMs,
      rounds: force ? 10 : 6
    });
  }

  if (needsFullContactSync(entry, { minExpected: 5 })) {
    await waitForChatHydration(entry, maxWaitMs);
    await releaseBufferedBaileysEvents(entry);
  }

  console.log(
    `Contact sync done: store=${entry.contactStore.size}, contacts=${entry.contactMap.size}, chats=${entry.chatMap.size}`
  );

  return countContactEntries(entry) > 0;
};

const getQrTimeoutMs = (isRecovery = false) => (isRecovery ? 300000 : 120000);

const isClientReady = (userId) => {
  const entry = clients.get(userId.toString());
  return Boolean(entry?.client && entry.status === 'connected' && entry.client.sendMessage);
};

const isClientPending = (userId) => {
  const userIdStr = userId.toString();
  const entry = clients.get(userIdStr);
  return Boolean(
    entry && (entry.status === 'pending' || clientsBeingCreated.has(userIdStr))
  ) || pendingAutoReconnect.has(userIdStr);
};

const waitForClientReady = async (userId, maxMs = 20000) => {
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    if (isClientReady(userId)) return getClient(userId);
    await sleep(500);
  }
  return null;
};

const getOrRestoreReadyClient = async (userId, { maxWaitMs = 45000 } = {}) => {
  const userIdStr = userId.toString();

  if (isClientReady(userId)) {
    return getClient(userId);
  }

  if (!(await canRecoverSession(userId))) {
    return null;
  }

  if (!isClientPending(userId)) {
    try {
      const { sendToUser } = require('./websocket');
      await ensureClientConnected(userId, sendToUser);
    } catch (err) {
      console.warn(`Scheduler session restore failed for ${userIdStr}: ${err.message}`);
    }
  }

  return waitForClientReady(userId, maxWaitMs);
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

const getConnectedPhoneNumber = (userId) => {
  const entry = clients.get(userId.toString());
  const jid = entry?.sock?.user?.id;
  return parseConnectedPhoneFromJid(jid);
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
    if (chats.length > 0) {
      entry.pickerDirty = true;
      invalidatePickerCache(userIdStr);
    }
    chats.forEach((chat) => upsertChatRecord(entry.chatMap, chat));
  });

  sock.ev.on('chats.upsert', (chats = []) => {
    if (chats.length > 0) {
      entry.pickerDirty = true;
      invalidatePickerCache(userIdStr);
    }
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
    if (contacts.length > 0) {
      entry.pickerDirty = true;
      invalidatePickerCache(userIdStr);
    }
    ingestContacts(entry, contacts);
  });

  sock.ev.on('contacts.upsert', (contacts = []) => {
    if (contacts.length > 0) {
      entry.pickerDirty = true;
      invalidatePickerCache(userIdStr);
    }
    ingestContacts(entry, contacts);
  });

  sock.ev.on('contacts.update', (updates = []) => {
    if (updates.length > 0) {
      entry.pickerDirty = true;
      invalidatePickerCache(userIdStr);
    }
    updates.forEach((update) => {
      const id = normalizeJid(update.id);
      if (!id) return;
      const merged = { ...entry.contactMap.get(id), ...update, id };
      ingestContact(entry, merged);
    });
  });

  sock.ev.on('messaging-history.set', ({ chats = [], contacts = [] }) => {
    if (chats.length > 0 || contacts.length > 0) {
      entry.pickerDirty = true;
      invalidatePickerCache(userIdStr);
      console.log(
        `messaging-history.set for ${userIdStr}: ${chats.length} chats, ${contacts.length} contacts`
      );
    }
    chats.forEach((chat) => upsertChatRecord(entry.chatMap, chat));
    ingestContacts(entry, contacts);
  });

  sock.ev.on('chats.phoneNumberShare', ({ lid, jid }) => {
    const { resolvePhoneFromChatId } = require('../utils/whatsappChat');
    const lidNorm = normalizeJid(lid);
    const phone = resolvePhoneFromChatId(normalizeJid(jid)) || resolvePhoneFromChatId(jid);
    if (lidNorm && phone) {
      entry.lidPhoneMap.set(lidNorm, phone);
      entry.pickerDirty = true;
      invalidatePickerCache(userIdStr);
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
      reconnectAttemptsByUser.delete(userIdStr);
      if (entry.qrTimeoutHandle) clearTimeout(entry.qrTimeoutHandle);

      const phone = parseConnectedPhoneFromJid(sock.user?.id);
      await markSessionLinked(userId, phone);
      if (phone) {
        ensureDefaultSchedulerAlertPhone(userId, phone).catch((err) => {
          console.warn(`Failed to set default scheduler alert phone for ${userIdStr}: ${err.message}`);
        });
      }
      onReady();

      setTimeout(() => {
        loadContactsAfterConnect(entry, userId, userIdStr).catch((err) => {
          console.warn(`Contact load after connect failed for ${userIdStr}: ${err.message}`);
        });
      }, 2500);
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;
      const reason = lastDisconnect?.error?.message || 'Connection closed';

      if (entry.qrTimeoutHandle) {
        clearTimeout(entry.qrTimeoutHandle);
        entry.qrTimeoutHandle = null;
      }

      clients.delete(userIdStr);
      clientsBeingCreated.delete(userIdStr);

      if (loggedOut) {
        await markSessionUnlinked(userId);
        await deleteStoredRemoteSession(userId);
      }

      if (!entry.shouldStayClosed && !loggedOut && entry.allowReconnect) {
        const attempts = (reconnectAttemptsByUser.get(userIdStr) || 0) + 1;
        reconnectAttemptsByUser.set(userIdStr, attempts);

        if (attempts > MAX_AUTO_RECONNECTS) {
          console.warn(`Baileys reconnect limit reached for ${userIdStr}, stopping auto-reconnect`);
          onDisconnected('WhatsApp connection unstable. Click Connect to retry.');
          return;
        }

        console.log(`Baileys reconnecting user ${userIdStr} (attempt ${attempts}/${MAX_AUTO_RECONNECTS})...`);
        pendingAutoReconnect.add(userIdStr);
        setTimeout(() => {
          pendingAutoReconnect.delete(userIdStr);
          createClient(userId, onQR, onReady, onDisconnected, {
            suppressQrNotification: entry.suppressQrNotification,
            freshAuth: false
          }).catch((err) => console.error(`Reconnect failed for ${userIdStr}:`, err.message));
        }, 3000);
        return;
      }

      reconnectAttemptsByUser.delete(userIdStr);
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

        const { handleSchedulerReply } = require('./schedulerReplyService');
        const handledByScheduler = await handleSchedulerReply(current.client, userId, wrapped);
        if (handledByScheduler) continue;

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
  const contactStore = new Map();
  const lidPhoneMap = new Map();

  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, silentLogger)
    },
    printQRInTerminal: false,
    logger: silentLogger,
    browser: ['WA Sender', 'Chrome', '1.0.0'],
    syncFullHistory: true,
    markOnlineOnConnect: false,
    fireInitQueries: true,
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
    contactStore,
    lidPhoneMap,
    pickerDirty: false,
    qrTimeoutHandle: null
  };

  entry.qrTimeoutHandle = setTimeout(async () => {
    const live = clients.get(userIdStr);
    if (!live || live.status !== 'pending' || live.qrReceived) return;

    console.warn(`QR timeout for user ${userIdStr}`);

    if (entry.suppressQrNotification) {
      // Keep session files on disk — only stop this restore attempt.
      await abortPendingClient(userId, 'Recovery timed out waiting for session restore');
      onDisconnected('Session restore timed out. Click Connect to try again.');
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
  if (pendingAutoReconnect.has(userIdStr)) return null;
  if (!(await canRecoverSession(userId))) return null;

  return createClient(
    userId,
    (qrImage) => sendToUser?.(userIdStr, { type: 'qr', qr: qrImage }),
    () => {
      const phoneNumber = getConnectedPhoneNumber(userId);
      sendToUser?.(userIdStr, { type: 'ready', phoneNumber });
    },
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
  if (hasContactData(entry)) return true;

  return new Promise((resolve) => {
    const onHydrate = () => {
      if (hasContactData(entry)) {
        cleanup();
        resolve(true);
      }
    };

    const timer = setTimeout(() => {
      cleanup();
      resolve(hasContactData(entry));
    }, maxMs);

    const cleanup = () => {
      clearTimeout(timer);
      entry.sock?.ev?.off('chats.upsert', onHydrate);
      entry.sock?.ev?.off('chats.update', onHydrate);
      entry.sock?.ev?.off('messaging-history.set', onHydrate);
      entry.sock?.ev?.off('contacts.set', onHydrate);
      entry.sock?.ev?.off('contacts.upsert', onHydrate);
      entry.sock?.ev?.off('contacts.update', onHydrate);
    };

    entry.sock?.ev?.on('chats.upsert', onHydrate);
    entry.sock?.ev?.on('chats.update', onHydrate);
    entry.sock?.ev?.on('messaging-history.set', onHydrate);
    entry.sock?.ev?.on('contacts.set', onHydrate);
    entry.sock?.ev?.on('contacts.upsert', onHydrate);
    entry.sock?.ev?.on('contacts.update', onHydrate);
  });
};

const hydratePickerMaps = async (entry, { maxWaitMs = 2000, allowResync = false } = {}) => {
  if (!entry) return;

  await releaseBufferedBaileysEvents(entry);
  if (!needsFullContactSync(entry)) return;

  if (allowResync) {
    await forceSyncWhatsAppContacts(entry, {
      maxWaitMs: Math.max(maxWaitMs, 45000),
      force: true,
      minExpected: MIN_EXPECTED_CONTACTS
    });
    return;
  }

  if (needsFullContactSync(entry)) {
    await waitForChatHydration(entry, maxWaitMs);
    await releaseBufferedBaileysEvents(entry);
  }
};

const loadContactsAfterConnect = async (entry, userId, userIdStr) => {
  if (!entry || entry.status !== 'connected') return;
  const targetMinExpected = getPickerMinExpected(userId, { limit: 500 });

  await forceSyncWhatsAppContacts(entry, {
    maxWaitMs: 60000,
    force: false,
    minExpected: targetMinExpected
  });

  console.log(
    `WhatsApp contact store for ${userIdStr}: store=${entry.contactStore.size}, contacts=${entry.contactMap.size}, chats=${entry.chatMap.size}`
  );

  if (hasContactData(entry)) {
    invalidatePickerCache(userIdStr);
    prewarmPickerCache(userId);
  }
};

const pickerCache = new Map();
const PICKER_CACHE_TTL_MS = 120000;
let prewarmPickerCache = () => {};

const invalidatePickerCache = (userIdStr) => {
  for (const key of [...pickerCache.keys()]) {
    if (key.startsWith(`${userIdStr}:`)) {
      pickerCache.delete(key);
    }
  }
};

const isPickerCacheUsable = (cached, entry, limit) => {
  if (!cached || !entry) return false;

  const chatCount = Math.max(entry.chatMap?.size || 0, entry.contactStore?.size || 0);
  const cachedCount = cached.contacts?.length || 0;
  const minExpected = chatCount < 50
    ? Math.min(10, limit)
    : Math.min(limit, Math.max(25, Math.floor(chatCount * 0.02)));

  return cachedCount >= minExpected;
};

const { getRecentChatsFromDb } = require('../utils/whatsappChat');
const { loadPickerContactCache, savePickerContactCache } = require('../utils/pickerContactCache');

const getPickerMinExpected = (userId, { limit = 500 } = {}) => {
  const diskCached = loadPickerContactCache(userId.toString());
  const cachedCount = Array.isArray(diskCached) ? diskCached.length : 0;
  const targetFromCache = cachedCount > 0
    ? Math.max(MIN_EXPECTED_CONTACTS, Math.floor(cachedCount * 0.75))
    : 0;

  return Math.min(limit, Math.max(DEFAULT_TARGET_CONTACTS, targetFromCache));
};

const getPickerContacts = async (userId, { limit = 500, forceRefresh = false } = {}) => {
  const userIdStr = userId.toString();
  const cacheKey = `${userIdStr}:${limit}`;
  const started = Date.now();

  if (forceRefresh) {
    invalidatePickerCache(userIdStr);
  }

  const cached = pickerCache.get(cacheKey);
  const entryPreview = clients.get(userIdStr);

  if (
    !forceRefresh &&
    cached &&
    Date.now() - cached.at < PICKER_CACHE_TTL_MS &&
    isPickerCacheUsable(cached, entryPreview, limit)
  ) {
    return cached.contacts;
  }

  if (cached) {
    pickerCache.delete(cacheKey);
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

  const targetMinExpected = getPickerMinExpected(userId, { limit });
  if (needsFullContactSync(entry, { minExpected: targetMinExpected })) {
    await forceSyncWhatsAppContacts(entry, {
      maxWaitMs: forceRefresh ? 90000 : 45000,
      force: forceRefresh,
      minExpected: targetMinExpected
    });
  } else {
    await releaseBufferedBaileysEvents(entry);
  }

  let lidPhoneMap = buildLidPhoneMap(entry.contactMap, entry.lidPhoneMap);
  const selfDigits = String(entry.sock?.user?.id || '').split('@')[0] || '';

  const buildContacts = () => {
    const fromMaps = getChatsForPicker(entry.chatMap, entry.contactMap, {
      limit,
      lidPhoneMap,
      excludePhoneDigits: selfDigits
    });

    const fromStore =
      entry.contactStore.size > 0
        ? contactsFromPickerStore(entry.contactStore, {
            limit,
            excludePhoneDigits: selfDigits,
            lidPhoneMap,
            contactMap: entry.contactMap
          })
        : [];

    if (fromStore.length === 0) return fromMaps;

    const { mergePickerRows, sortPickerContacts } = require('../utils/whatsappChat');
    const merged = mergePickerRows([...fromMaps, ...fromStore]);
    return sortPickerContacts(merged).slice(0, limit);
  };

  let contacts = buildContacts();

  const maxLidLookup = forceRefresh ? 200 : 120;
  const unresolvedLids = collectRecentUnresolvedLids(
    entry.chatMap,
    lidPhoneMap,
    maxLidLookup,
    entry.contactMap
  );

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
    `Picker maps for ${userIdStr}: chats=${entry.chatMap.size}, contacts=${entry.contactMap.size}, store=${entry.contactStore.size}, lidMap=${lidPhoneMap.size}, picked=${contacts.length} in ${Date.now() - started}ms`
  );

  if (contacts.length < MIN_EXPECTED_CONTACTS) {
    const diskCached = loadPickerContactCache(userIdStr);
    if (diskCached.length > contacts.length) {
      const { mergePickerRows, sortPickerContacts } = require('../utils/whatsappChat');
      contacts = sortPickerContacts(mergePickerRows([...contacts, ...diskCached])).slice(0, limit);
      console.log(`Picker disk cache merged for ${userIdStr}: ${contacts.length} contacts`);
    }
  }

  if (contacts.length === 0) {
    contacts = await getRecentChatsFromDb(userId, { limit });
    console.log(`Picker DB fallback for ${userIdStr}: ${contacts.length} contacts`);
  }

  if (contacts.length >= 20) {
    savePickerContactCache(userIdStr, contacts);
  }

  if (contacts.length > 0 && isPickerCacheUsable({ contacts }, entry, limit)) {
    pickerCache.set(cacheKey, { contacts, at: Date.now() });
  }

  return contacts;
};

prewarmPickerCache = (userId) => {
  const userIdStr = userId.toString();
  setTimeout(() => {
    getPickerContacts(userId, { limit: 500, forceRefresh: false }).catch(() => {});
  }, 8000);
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
  getConnectedPhoneNumber,
  isClientReady,
  isClientPending,
  waitForClientReady,
  getOrRestoreReadyClient,
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
