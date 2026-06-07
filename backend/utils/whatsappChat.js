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

  const candidates = [
    contact.number,
    contact.id?.user,
    contact.id?._serialized?.split('@')[0]
  ].filter(Boolean);

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

const resolveMessageContact = async (msg) => {
  const chatId = String(msg.from || '');
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

  if (!contactPhone) {
    const userPart = chatId.split('@')[0];
    if (looksLikePhoneDigits(userPart)) {
      contactPhone = normalizePhoneValue(userPart) || chatId;
    } else {
      contactPhone = chatId;
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
  const phoneDigits = extractDigits(contactPhone);
  const chatDigits = extractDigits(chatId.split('@')[0]);

  if (!selectedDigits) return false;

  return (
    selectedDigits === phoneDigits ||
    selectedDigits === chatDigits ||
    phoneDigits.endsWith(selectedDigits) ||
    selectedDigits.endsWith(phoneDigits)
  );
};

const isContactSelected = (selectedContacts = [], chatId, contactPhone) =>
  selectedContacts.some((selection) => contactMatchesSelection(selection, chatId, contactPhone));

const serializeChatContact = (chat) => {
  if (!chat || chat.isGroup) return null;

  const chatId = chat.id?._serialized || '';
  const server = getChatServer(chatId);
  if (!chatId || !PERSONAL_CHAT_SERVERS.has(server)) return null;

  const userPart = chatId.split('@')[0];
  const phoneNumber = looksLikePhoneDigits(userPart)
    ? normalizePhoneValue(userPart) || chatId
    : chatId;

  const name = chat.name || phoneNumber;

  return {
    chatId,
    name,
    phoneNumber,
    source: 'whatsapp'
  };
};

const getChatTimestamp = (chat) => {
  const ts = chat?.timestamp;
  if (ts && typeof ts === 'object' && ts.low !== undefined) return ts.low;
  return Number(ts) || 0;
};

const fetchWhatsAppContacts = async (client, { limit = 300 } = {}) => {
  const chats = await client.getChats();

  const personalChats = chats
    .filter((chat) => !chat.isGroup)
    .filter((chat) => {
      const chatId = chat.id?._serialized || '';
      return chatId && PERSONAL_CHAT_SERVERS.has(getChatServer(chatId));
    })
    .sort((a, b) => getChatTimestamp(b) - getChatTimestamp(a))
    .slice(0, limit);

  const serialized = [];
  const seen = new Set();

  for (const chat of personalChats) {
    const item = serializeChatContact(chat);
    if (!item || seen.has(item.chatId)) continue;
    seen.add(item.chatId);
    serialized.push(item);
  }

  serialized.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  return serialized;
};

module.exports = {
  isChatId,
  isAutoReplyEligibleMessage,
  resolveMessageContact,
  isContactSelected,
  contactMatchesSelection,
  serializeChatContact,
  fetchWhatsAppContacts,
  normalizePhoneValue
};
