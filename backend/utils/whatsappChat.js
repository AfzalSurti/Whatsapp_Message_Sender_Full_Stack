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
    contactPhone = await resolvePhoneFromContact(contact);
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

const serializeWhatsAppContact = async (contact) => {
  if (!contact || contact.isMe || contact.isGroup || contact.isBlocked) return null;

  const chatId = contact.id?._serialized || '';
  const server = getChatServer(chatId);

  if (!PERSONAL_CHAT_SERVERS.has(server)) return null;
  if (contact.isUser === false && contact.isWAContact === false) return null;

  const phoneNumber = (await resolvePhoneFromContact(contact)) || chatId;
  const name = contact.name || contact.pushname || contact.shortName || contact.verifiedName || phoneNumber;

  return {
    chatId,
    name,
    phoneNumber,
    isMyContact: Boolean(contact.isMyContact)
  };
};

const fetchWhatsAppContacts = async (client) => {
  const contacts = await client.getContacts();
  const serialized = [];

  for (const contact of contacts) {
    try {
      const item = await serializeWhatsAppContact(contact);
      if (item) serialized.push(item);
    } catch (err) {
      console.warn(`Skipping WhatsApp contact during serialization: ${err.message}`);
    }
  }

  serialized.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  const seen = new Set();
  return serialized.filter((item) => {
    const key = item.chatId || item.phoneNumber;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

module.exports = {
  isChatId,
  isAutoReplyEligibleMessage,
  resolveMessageContact,
  isContactSelected,
  contactMatchesSelection,
  serializeWhatsAppContact,
  fetchWhatsAppContacts,
  normalizePhoneValue
};
