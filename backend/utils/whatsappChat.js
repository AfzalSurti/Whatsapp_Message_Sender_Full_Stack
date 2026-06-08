const { normalizePhoneNumber } = require('./phone');

const PERSONAL_CHAT_SERVERS = new Set(['c.us', 's.whatsapp.net', 'lid']);
const BLOCKED_CHAT_SERVERS = new Set(['g.us', 'newsletter', 'broadcast']);

const getChatServer = (chatId = '') => String(chatId).split('@')[1] || '';

const isChatId = (value = '') => /@(c\.us|s\.whatsapp\.net|lid)$/.test(String(value).trim());

const extractDigits = (value = '') => String(value).replace(/\D/g, '');

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
  const selected = selectedContacts.map((value) => String(value || '').trim()).filter(Boolean);

  if (selected.includes(chatId)) return true;

  return selected.some((selection) => contactMatchesSelection(selection, chatId, contactPhone));
};

const looksLikeFormattedPhone = (value = '') => {
  const raw = String(value || '').trim();
  if (!raw) return false;
  const digits = extractDigits(raw);
  return digits.length >= 7 && /^[\d\s+\-().]+$/.test(raw);
};

const pickContactDisplayName = (contact, chat, fallback) => {
  const savedName = String(contact?.name || '').trim();
  const pushName = String(contact?.pushname || '').trim();
  const shortName = String(contact?.shortName || '').trim();
  const verifiedName = String(contact?.verifiedName || '').trim();
  const chatName = String(chat?.name || '').trim();

  if (savedName) return savedName;
  if (pushName && !looksLikeFormattedPhone(pushName)) return pushName;
  if (shortName && !looksLikeFormattedPhone(shortName)) return shortName;
  if (verifiedName && !looksLikeFormattedPhone(verifiedName)) return verifiedName;
  if (chatName && !looksLikeFormattedPhone(chatName)) return chatName;

  return pushName || chatName || fallback;
};

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

const fetchRecentChatsFromStore = async (client, limit = 100) => {
  if (!client?.pupPage || (client.pupPage.isClosed && client.pupPage.isClosed())) {
    throw new Error('WhatsApp browser page not available');
  }

  const rows = await client.pupPage.evaluate((max) => {
    const chats = window.Store?.Chat?.getModelsArray?.() || [];

    return chats
      .filter((chat) => !chat.isGroup)
      .filter((chat) => {
        const chatId = chat.id?._serialized || '';
        const server = chatId.split('@')[1] || '';
        return chatId && ['c.us', 's.whatsapp.net', 'lid'].includes(server);
      })
      .sort((a, b) => {
        const tsA = a.t?.low ?? a.t ?? 0;
        const tsB = b.t?.low ?? b.t ?? 0;
        return tsB - tsA;
      })
      .slice(0, max)
      .map((chat) => {
        const chatId = chat.id._serialized;
        const server = chatId.split('@')[1] || '';
        const userPart = chatId.split('@')[0];
        const name = String(chat.name || chat.formattedTitle || userPart || '').trim();
        return { chatId, name, server, userPart };
      });
  }, limit);

  const serialized = [];
  const seen = new Set();

  for (const row of rows) {
    if (!row?.chatId || seen.has(row.chatId)) continue;
    seen.add(row.chatId);

    const phoneNumber =
      row.server === 'lid'
        ? ''
        : resolvePhoneFromChatId(row.chatId) || normalizePhoneValue(row.userPart) || '';

    serialized.push({
      chatId: row.chatId,
      name: row.name || row.userPart,
      phoneNumber: phoneNumber && !String(phoneNumber).includes('@') ? phoneNumber : '',
      source: 'whatsapp'
    });
  }

  return serialized;
};

const fetchWhatsAppContacts = async (client, { limit = 100, enrich = false } = {}) => {
  try {
    const fastList = await fetchRecentChatsFromStore(client, limit);
    if (fastList.length > 0) {
      fastList.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
      return fastList;
    }
  } catch (err) {
    console.warn(`Fast WhatsApp contact list failed, falling back to getChats: ${err.message}`);
  }

  const chats = await client.getChats();

  const personalChats = chats
    .filter((chat) => !chat.isGroup)
    .filter((chat) => {
      const chatId = chat.id?._serialized || '';
      return chatId && PERSONAL_CHAT_SERVERS.has(getChatServer(chatId));
    })
    .sort((a, b) => getChatTimestamp(b) - getChatTimestamp(a))
    .slice(0, limit);

  const mapper = enrich ? enrichChatContact : async (chat) => serializeChatContact(chat);
  const enriched = enrich
    ? await mapWithConcurrency(personalChats, 2, mapper)
    : personalChats.map((chat) => serializeChatContact(chat));

  const serialized = [];
  const seen = new Set();

  for (const item of enriched) {
    if (!item || seen.has(item.chatId)) continue;
    seen.add(item.chatId);
    serialized.push(item);
  }

  serialized.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  return serialized;
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
  getChatTimestamp,
  normalizePhoneValue
};
