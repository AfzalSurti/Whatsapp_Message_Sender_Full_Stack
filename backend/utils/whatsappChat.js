const { normalizePhoneNumber } = require('./phone');
const { jidDecode } = require('@whiskeysockets/baileys');

const PERSONAL_CHAT_SERVERS = new Set(['c.us', 's.whatsapp.net', 'lid']);
const BLOCKED_CHAT_SERVERS = new Set(['g.us', 'newsletter', 'broadcast']);

const getChatServer = (chatId = '') => String(chatId).split('@')[1] || '';

const isChatId = (value = '') => /@(c\.us|s\.whatsapp\.net|lid)$/.test(String(value).trim());

const extractDigits = (value = '') => String(value).replace(/\D/g, '');

/** Phone from Baileys user JID — strips device suffix (e.g. 916355209044:30 → +916355209044). */
const parseConnectedPhoneFromJid = (jid) => {
  if (!jid) return null;

  const raw = typeof jid === 'string' ? jid : String(jid.id || jid._serialized || jid);
  const decoded = jidDecode(raw);
  const userPart = decoded?.user || raw.split('@')[0]?.split(':')[0] || '';
  if (!userPart) return null;

  return normalizePhoneValue(userPart) || null;
};

const looksLikePhoneDigits = (value = '') => {
  const digits = extractDigits(value);
  return digits.length >= 7 && digits.length <= 15;
};

const normalizePhoneValue = (value) => {
  const raw = String(value || '').trim();
  if (!raw || isChatId(raw)) return null;

  const normalized = normalizePhoneNumber(raw.startsWith('+') ? raw : `+${extractDigits(raw)}`);
  return normalized?.e164 || null;
};

const resolvePhoneFromContactSync = (contact) => {
  if (!contact) return null;

  const serialized = String(contact.id?._serialized || '');
  const isLidContact = serialized.endsWith('@lid');

  const candidates = isLidContact
    ? [contact.number].filter(Boolean)
    : [contact.number, contact.id?.user, serialized.split('@')[0]].filter(Boolean);

  for (const candidate of candidates) {
    const normalized = normalizePhoneValue(candidate);
    if (normalized) return normalized;
  }

  return null;
};

const isAutoReplyEligibleMessage = (msg) => {
  if (!msg || msg.fromMe) return false;
  if (msg.isStatus || msg.broadcast) return false;

  const chatId = String(msg.from || '');
  if (!chatId || chatId === 'status@broadcast') return false;

  const server = getChatServer(chatId);
  if (BLOCKED_CHAT_SERVERS.has(server)) return false;

  return PERSONAL_CHAT_SERVERS.has(server);
};

const resolvePhoneFromContact = async (contact) => {
  const syncValue = resolvePhoneFromContactSync(contact);
  if (syncValue) return syncValue;

  try {
    const formatted = await contact.getFormattedNumber();
    return normalizePhoneValue(formatted);
  } catch {
    return null;
  }
};

const isValidResolvedPhone = (value = '') => {
  const raw = String(value || '').trim();
  if (!raw || raw.includes('@')) return false;
  const digits = extractDigits(raw);
  return digits.length >= 7 && digits.length <= 15;
};

const resolvePhoneFromChatId = (chatId) => {
  const server = getChatServer(chatId);
  if (server === 'lid') return null;

  const userPart = chatId.split('@')[0];
  if (!looksLikePhoneDigits(userPart)) return null;

  return normalizePhoneValue(userPart);
};

const resolveMessageContact = async (msg) => {
  const chatId = String(msg.from || '');
  const server = getChatServer(chatId);
  let contactName = '';
  let contactPhone = '';
  let contact = null;

  try {
    contact = await msg.getContact();
    contactName = contact.pushname || contact.name || contact.shortName || contact.verifiedName || '';
    contactPhone = (await resolvePhoneFromContact(contact)) || resolvePhoneFromContactSync(contact);
  } catch (err) {
    console.warn(`Could not resolve WhatsApp contact for auto-reply: ${err.message}`);
  }

  if (contact && (!isValidResolvedPhone(contactPhone) || server === 'lid')) {
    try {
      const formatted = await contact.getFormattedNumber();
      const normalized = normalizePhoneValue(formatted);
      if (normalized) contactPhone = normalized;
    } catch {
      // keep trying other fallbacks
    }
  }

  if (!isValidResolvedPhone(contactPhone)) {
    const fromChatId = resolvePhoneFromChatId(chatId);
    if (fromChatId) {
      contactPhone = fromChatId;
    } else if (server === 'lid') {
      contactPhone = chatId;
    } else {
      const userPart = chatId.split('@')[0];
      contactPhone = looksLikePhoneDigits(userPart) ? normalizePhoneValue(userPart) || chatId : chatId;
    }
  }

  return {
    chatId,
    contactName,
    contactPhone,
    contact
  };
};

const contactMatchesSelection = (selection, chatId, contactPhone) => {
  const selected = String(selection || '').trim();
  if (!selected) return false;

  if (isChatId(selected)) {
    return selected === chatId;
  }

  const selectedDigits = extractDigits(selected);
  const phoneDigits = isValidResolvedPhone(contactPhone) ? extractDigits(contactPhone) : '';
  const chatDigits =
    getChatServer(chatId) !== 'lid' && looksLikePhoneDigits(chatId.split('@')[0])
      ? extractDigits(chatId.split('@')[0])
      : '';

  if (!selectedDigits) return false;

  if (phoneDigits) {
    return (
      selectedDigits === phoneDigits ||
      phoneDigits.endsWith(selectedDigits) ||
      selectedDigits.endsWith(phoneDigits)
    );
  }

  if (chatDigits) {
    return selectedDigits === chatDigits || chatDigits.endsWith(selectedDigits) || selectedDigits.endsWith(chatDigits);
  }

  return false;
};

const isContactSelected = (selectedContacts = [], chatId, contactPhone) => {
  return selectedContacts.some((contact) => {
    if (!contact) return false;

    if (typeof contact === "string") {
      return (
        contact === chatId ||
        contactMatchesSelection(contact, chatId, contactPhone)
      );
    }

    return (
      contact.chatId === chatId ||
      contactMatchesSelection(contact.chatId, chatId, contactPhone) ||
      contactMatchesSelection(contact.phoneNumber, chatId, contactPhone)
    );
  });
};
const looksLikeFormattedPhone = (value = '') => {
  const raw = String(value || '').trim();
  if (!raw) return false;
  const digits = extractDigits(raw);
  return digits.length >= 7 && /^[\d\s+\-().]+$/.test(raw);
};

const isPhoneLikeDisplayName = (name = '', phoneNumber = '') => {
  const trimmed = String(name || '').trim();
  if (!trimmed) return true;
  if (looksLikeFormattedPhone(trimmed)) return true;

  const phoneDigits = extractDigits(phoneNumber || '');
  const nameDigits = extractDigits(trimmed);
  if (phoneDigits && nameDigits && phoneDigits === nameDigits) return true;
  if (!phoneDigits && nameDigits.length >= 10 && /^\d+$/.test(trimmed.replace(/\s/g, ''))) return true;

  return false;
};

const pickBetterDisplayName = (left = '', right = '', phoneNumber = '') => {
  const leftBad = isPhoneLikeDisplayName(left, phoneNumber);
  const rightBad = isPhoneLikeDisplayName(right, phoneNumber);

  if (leftBad && !rightBad) return right;
  if (rightBad && !leftBad) return left;
  if (!leftBad) return left;
  if (!rightBad) return right;
  return left || right;
};

const pickContactDisplayName = (contact, chat, fallback) => {
  const savedName = String(contact?.name || '').trim();
  const pushName = String(contact?.pushname || contact?.notify || '').trim();
  const shortName = String(contact?.shortName || '').trim();
  const verifiedName = String(contact?.verifiedName || '').trim();
  const chatName = String(chat?.name || chat?.pushName || chat?.subject || '').trim();

  if (savedName && !isPhoneLikeDisplayName(savedName)) return savedName;
  if (pushName && !isPhoneLikeDisplayName(pushName)) return pushName;
  if (shortName && !isPhoneLikeDisplayName(shortName)) return shortName;
  if (verifiedName && !isPhoneLikeDisplayName(verifiedName)) return verifiedName;
  if (chatName && !isPhoneLikeDisplayName(chatName)) return chatName;

  const fallbackStr = String(fallback || '').trim();
  if (fallbackStr && !isPhoneLikeDisplayName(fallbackStr)) return fallbackStr;

  return savedName || pushName || chatName || verifiedName || shortName || '';
};

const baileysContactToPickerShape = (contact = null) => {
  if (!contact) return null;

  return {
    name: contact.name,
    pushname: contact.notify,
    shortName: contact.notify,
    verifiedName: contact.verifiedName,
    number: contact.phoneNumber || contact.number || contact.phone
  };
};

const resolvePickerPhone = (chatId, chat = {}, contact = null, lidPhoneMap = null) => {
  const normalizedId = String(chatId || '').trim();
  const server = getChatServer(normalizedId);
  const userPart = normalizedId.split('@')[0] || '';

  if (server === 's.whatsapp.net' || server === 'c.us') {
    const fromJid = resolvePhoneFromChatId(normalizedId);
    if (fromJid) return fromJid;
  }

  if (server === 'lid' && lidPhoneMap) {
    const fromLidMap = lidPhoneMap.get(normalizedId);
    if (fromLidMap) return fromLidMap;
  }

  if (contact) {
    const fromContact = resolvePhoneFromContactSync({
      id: { _serialized: normalizedId, user: userPart },
      number: contact.phoneNumber || contact.number || contact.phone
    });
    if (fromContact) return fromContact;

    if (contact.lid && lidPhoneMap) {
      const linkedLid = String(contact.lid).includes('@')
        ? contact.lid
        : `${contact.lid}@lid`;
      const fromLinkedLid = lidPhoneMap.get(linkedLid);
      if (fromLinkedLid) return fromLinkedLid;
    }
  }

  return null;
};

const classifyPickerContact = (name, contact = null, phoneNumber = '') => {
  const savedName = String(contact?.name || '').trim();
  const displayName = String(name || '').trim();
  const phoneDigits = extractDigits(phoneNumber || displayName);

  const isSaved = Boolean(savedName);
  const hasDisplayName =
    Boolean(displayName) &&
    !isPhoneLikeDisplayName(displayName, phoneNumber);

  let sortRank = 2;
  if (isSaved) sortRank = 0;
  else if (hasDisplayName) sortRank = 1;

  return { isSaved, hasDisplayName, sortRank };
};

const mergePickerRows = (rows = []) => {
  const mergedByPhone = new Map();
  const mergedByChat = new Map();

  const scoreRow = (row) => {
    let score = 0;
    if (row.isSaved) score += 100;
    if (row.hasDisplayName) score += 20;
    if (row.phoneNumber) score += 10;
    if (String(row.chatId || '').endsWith('@s.whatsapp.net')) score += 5;
    return score;
  };

  const mergeInto = (target, incoming) => {
    const targetScore = scoreRow(target);
    const incomingScore = scoreRow(incoming);
    const winner = incomingScore > targetScore ? incoming : target;
    const loser = winner === incoming ? target : incoming;

    return {
      ...loser,
      ...winner,
      chatId: winner.chatId || loser.chatId,
      name: pickBetterDisplayName(winner.name, loser.name, winner.phoneNumber || loser.phoneNumber),
      phoneNumber: winner.phoneNumber || loser.phoneNumber,
      isSaved: winner.isSaved || loser.isSaved,
      hasDisplayName: winner.hasDisplayName || loser.hasDisplayName,
      sortRank: Math.min(winner.sortRank, loser.sortRank)
    };
  };

  rows.forEach((row) => {
    const phoneDigits = extractDigits(row.phoneNumber || '');
    if (phoneDigits) {
      const existing = mergedByPhone.get(phoneDigits);
      mergedByPhone.set(phoneDigits, existing ? mergeInto(existing, row) : row);
      return;
    }

    const existing = mergedByChat.get(row.chatId);
    mergedByChat.set(row.chatId, existing ? mergeInto(existing, row) : row);
  });

  const phoneRows = Array.from(mergedByPhone.values());
  const phoneDigitSet = new Set(phoneRows.map((row) => extractDigits(row.phoneNumber || '')));

  mergedByChat.forEach((row) => {
    const digits = extractDigits(row.phoneNumber || '');
    if (digits && phoneDigitSet.has(digits)) return;
    phoneRows.push(row);
  });

  return phoneRows;
};

const sortPickerContacts = (rows = []) =>
  [...rows].sort((a, b) => {
    if (a.sortRank !== b.sortRank) return a.sortRank - b.sortRank;
    return String(a.name || '').localeCompare(String(b.name || ''), undefined, {
      sensitivity: 'base',
      numeric: true
    });
  });

const mapWithConcurrency = async (items, limit, mapper) => {
  if (items.length === 0) return [];

  const results = new Array(items.length);
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < items.length) {
      const current = nextIndex;
      nextIndex += 1;
      results[current] = await mapper(items[current], current);
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
};

const serializeChatContact = (chat) => {
  if (!chat || chat.isGroup) return null;

  const chatId = chat.id?._serialized || '';
  const server = getChatServer(chatId);
  if (!chatId || !PERSONAL_CHAT_SERVERS.has(server)) return null;

  const phoneNumber = resolvePhoneFromChatId(chatId) || (server === 'lid' ? '' : chatId);
  const name = pickContactDisplayName(null, chat, phoneNumber || chatId.split('@')[0]);

  return {
    chatId,
    name,
    phoneNumber,
    source: 'whatsapp'
  };
};

const enrichChatContact = async (chat) => {
  const base = serializeChatContact(chat);
  if (!base) return null;

  const nameFromChat = pickContactDisplayName(null, chat, base.name);

  // LID chats: avoid getContact() — it often fails and can disrupt WA comms for auto-reply
  if (getChatServer(base.chatId) === 'lid') {
    return {
      ...base,
      name: nameFromChat,
      phoneNumber: ''
    };
  }

  try {
    const contact = await chat.getContact();
    const phoneNumber =
      (await resolvePhoneFromContact(contact)) ||
      resolvePhoneFromContactSync(contact) ||
      base.phoneNumber;

    const safePhone = phoneNumber && !String(phoneNumber).includes('@') ? phoneNumber : base.phoneNumber;
    const name = pickContactDisplayName(contact, chat, safePhone || nameFromChat);

    return {
      ...base,
      name,
      phoneNumber: safePhone && !String(safePhone).includes('@') ? safePhone : ''
    };
  } catch (err) {
    console.warn(`Could not enrich WhatsApp chat contact ${base.chatId}: ${err.message}`);
    return {
      ...base,
      name: nameFromChat,
      phoneNumber: base.phoneNumber && !String(base.phoneNumber).includes('@') ? base.phoneNumber : ''
    };
  }
};

const getChatTimestamp = (chat) => {
  const ts = chat?.timestamp;
  if (ts && typeof ts === 'object' && ts.low !== undefined) return ts.low;
  return Number(ts) || 0;
};

const withTimeout = (promise, ms, label) =>
  Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    })
  ]);

const getRecentChatsFromDb = async (userId, { limit = 100 } = {}) => {
  const AutoReplyLog = require('../models/AutoReplyLog');
  const MessageLog = require('../models/MessageLog');
  const ContactGroup = require('../models/ContactGroup');

  const seen = new Set();
  const rows = [];

  const pushRow = (phone, name = '') => {
    const normalized = normalizePhoneValue(phone);
    if (!normalized || String(normalized).includes('@')) return;

    const digits = String(normalized).replace(/\D/g, '');
    if (!digits || seen.has(digits)) return;

    seen.add(digits);
    rows.push({
      chatId: `${digits}@s.whatsapp.net`,
      name: String(name || '').trim() || normalized,
      phoneNumber: normalized,
      source: 'recent'
    });
  };

  const [autoReplyLogs, messageLogs, groups] = await Promise.all([
    AutoReplyLog.find({ userId })
      .sort({ createdAt: -1 })
      .limit(200)
      .select('contactPhone contactName')
      .lean(),
    MessageLog.find({ userId })
      .sort({ createdAt: -1 })
      .limit(200)
      .select('number')
      .lean(),
    ContactGroup.find({ userId }).select('numbers').lean()
  ]);

  autoReplyLogs.forEach((log) => pushRow(log.contactPhone, log.contactName));
  messageLogs.forEach((log) => pushRow(log.number));
  groups.forEach((group) => {
    (group.numbers || []).forEach((entry) => pushRow(entry.phone, entry.name));
  });

  const classified = rows.map((row) => {
    const nameDigits = extractDigits(row.name || '');
    const phoneDigits = extractDigits(row.phoneNumber || '');
    const contactHint =
      row.name &&
      !looksLikeFormattedPhone(row.name) &&
      nameDigits !== phoneDigits
        ? { name: row.name }
        : null;

    const { isSaved, hasDisplayName, sortRank } = classifyPickerContact(
      row.name,
      contactHint,
      row.phoneNumber
    );
    return { ...row, isSaved, hasDisplayName, sortRank };
  });

  return sortPickerContacts(classified).slice(0, limit);
};

const fetchWhatsAppContacts = async (client, { limit = 100, userId = null } = {}) => {
  if (typeof client?.getChatsForPicker === 'function') {
    return client.getChatsForPicker(limit);
  }

  throw new Error('WhatsApp client does not support contact listing');
};

const isPersonalChat = (chat) => {
  if (!chat || chat.isGroup) return false;
  const chatId = chat.id?._serialized || '';
  return Boolean(chatId && PERSONAL_CHAT_SERVERS.has(getChatServer(chatId)));
};

module.exports = {
  isChatId,
  isAutoReplyEligibleMessage,
  isPersonalChat,
  resolveMessageContact,
  isContactSelected,
  contactMatchesSelection,
  enrichChatContact,
  fetchWhatsAppContacts,
  getRecentChatsFromDb,
  getChatTimestamp,
  normalizePhoneValue,
  parseConnectedPhoneFromJid,
  resolvePhoneFromChatId,
  extractDigits,
  isPhoneLikeDisplayName,
  pickBetterDisplayName,
  baileysContactToPickerShape,
  resolvePickerPhone,
  classifyPickerContact,
  mergePickerRows,
  sortPickerContacts,
  pickContactDisplayName
};
