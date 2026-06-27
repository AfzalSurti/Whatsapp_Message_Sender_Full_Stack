const { jidNormalizedUser } = require('@whiskeysockets/baileys');
const PERSONAL_SERVERS = new Set(['s.whatsapp.net', 'lid', 'c.us']);

const normalizeJid = (value) => {
  if (!value) return '';
  const raw = typeof value === 'string' ? value : String(value.id || value._serialized || value.user || '');
  if (!raw) return '';
  if (raw.includes('@')) return jidNormalizedUser(raw) || raw;
  return raw;
};

const isPersonalChatJid = (chatId) => {
  const normalized = normalizeJid(chatId);
  if (!normalized || normalized.endsWith('@g.us')) return false;
  const server = normalized.split('@')[1] || '';
  return PERSONAL_SERVERS.has(server);
};

const toBaileysJid = (chatId) => {
  const raw = String(chatId || '').trim();
  if (!raw) return '';

  if (raw.includes('@')) {
    return raw.replace('@c.us', '@s.whatsapp.net');
  }

  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  return `${digits}@s.whatsapp.net`;
};

const extractMessageText = (waMessage) => {
  const content = waMessage?.message;
  if (!content) return '';

  if (content.conversation) return content.conversation;
  if (content.extendedTextMessage?.text) return content.extendedTextMessage.text;
  if (content.imageMessage?.caption) return content.imageMessage.caption;
  if (content.videoMessage?.caption) return content.videoMessage.caption;
  if (content.documentMessage?.caption) return content.documentMessage.caption;
  if (content.buttonsResponseMessage?.selectedDisplayText) {
    return content.buttonsResponseMessage.selectedDisplayText;
  }
  if (content.listResponseMessage?.title) return content.listResponseMessage.title;

  return '';
};

const isMediaLikePayload = (content) =>
  Boolean(
    content &&
      typeof content === 'object' &&
      (content.mimetype || content.data || content.dataUrl)
  );

const buildMediaContent = (payload = {}, caption = '') => {
  const mimeType = String(payload.mimetype || payload.mimeType || 'application/octet-stream');
  const base64 = String(payload.data || payload.base64 || '');
  const dataUrl = String(payload.dataUrl || '');

  let buffer;
  if (base64) {
    buffer = Buffer.from(base64, 'base64');
  } else if (dataUrl.startsWith('data:')) {
    const comma = dataUrl.indexOf(',');
    buffer = Buffer.from(dataUrl.slice(comma + 1), 'base64');
  }

  if (!buffer?.length) {
    throw new Error('Media payload is empty');
  }

  const fileName = payload.filename || payload.fileName || payload.name || 'file';

  if (mimeType.startsWith('image/')) {
    return { image: buffer, caption: caption || undefined };
  }

  if (mimeType.startsWith('video/')) {
    return { video: buffer, caption: caption || undefined };
  }

  if (mimeType.startsWith('audio/')) {
    return { audio: buffer, mimetype: mimeType, ptt: mimeType.includes('ogg') };
  }

  return {
    document: buffer,
    mimetype: mimeType,
    fileName,
    caption: caption || undefined
  };
};

const createSendMessage = (sock) => async (chatId, content, options = {}) => {
  const jid = toBaileysJid(chatId);
  if (!jid) throw new Error('Invalid chat id');

  if (typeof content === 'string') {
    return sock.sendMessage(jid, { text: content }, options);
  }

  if (isMediaLikePayload(content)) {
    const mediaContent = buildMediaContent(content, options.caption || content.caption);
    return sock.sendMessage(jid, mediaContent, options);
  }

  if (content && typeof content === 'object') {
    return sock.sendMessage(jid, content, options);
  }

  throw new Error('Unsupported message content');
};

const wrapIncomingMessage = (sock, waMessage, contactStore = new Map()) => {
  const chatId = String(waMessage?.key?.remoteJid || '');
  const body = extractMessageText(waMessage);
  const contact = contactStore.get(chatId);

  return {
    fromMe: Boolean(waMessage?.key?.fromMe),
    from: chatId,
    body,
    isStatus: chatId === 'status@broadcast',
    broadcast: false,
    id: {
      _serialized: String(waMessage?.key?.id || ''),
      id: waMessage?.key?.id
    },
    _baileys: waMessage,
    getContact: async () => ({
      name: contact?.name || waMessage.pushName || '',
      pushname: contact?.notify || waMessage.pushName || '',
      shortName: contact?.notify || '',
      verifiedName: contact?.verifiedName || '',
      number: chatId.split('@')[0],
      id: {
        user: chatId.split('@')[0],
        _serialized: chatId
      }
    }),
    reply: async (text, _chatId, replyOptions = {}) => {
      const jid = toBaileysJid(_chatId || chatId);
      return sock.sendMessage(jid, { text: String(text) }, { quoted: waMessage, ...replyOptions });
    }
  };
};

const upsertChatRecord = (chatMap, chat) => {
  const id = normalizeJid(chat?.id);
  if (!id) return;
  chatMap.set(id, { ...chatMap.get(id), ...chat, id });
};

const upsertContactRecord = (contactMap, contact) => {
  const id = normalizeJid(contact?.id);
  if (!id) return;
  contactMap.set(id, { ...contactMap.get(id), ...contact, id });
};

const hasPickerCandidates = (chatMap, contactMap) => {
  if (chatMap.size > 0) return true;

  for (const contact of contactMap.values()) {
    if (isPersonalChatJid(contact.id)) return true;
  }

  return false;
};

const getChatsForPicker = (chatMap, contactMap, { limit = 200 } = {}) => {
  const {
    baileysContactToPickerShape,
    resolvePickerPhone,
    classifyPickerContact,
    mergePickerRows,
    sortPickerContacts,
    pickContactDisplayName,
    normalizePhoneValue
  } = require('./whatsappChat');

  const rawRows = [];

  const buildRow = (chatId, chat = {}, contactRecord = null) => {
    const normalizedId = normalizeJid(chatId);
    if (!normalizedId || !isPersonalChatJid(normalizedId)) return;

    const pickerContact = baileysContactToPickerShape(contactRecord);
    const userPart = normalizedId.split('@')[0] || '';
    const phoneNumber = resolvePickerPhone(normalizedId, chat, contactRecord) || '';
    const fallback = phoneNumber ? normalizePhoneValue(phoneNumber)?.replace('+', '') || userPart : userPart;
    const name = pickContactDisplayName(pickerContact, chat, fallback);
    const { isSaved, hasDisplayName, sortRank } = classifyPickerContact(
      name,
      contactRecord,
      phoneNumber
    );

    rawRows.push({
      chatId: normalizedId,
      name,
      phoneNumber: phoneNumber && !String(phoneNumber).includes('@') ? phoneNumber : '',
      source: 'whatsapp',
      isSaved,
      hasDisplayName,
      sortRank
    });
  };

  // Saved address-book contacts first — most reliable names and numbers
  Array.from(contactMap.values()).forEach((contact) => {
    buildRow(contact.id, {}, contact);
  });

  // Then recent chats (may add chats not in contact list)
  Array.from(chatMap.values())
    .sort((a, b) => (Number(b.conversationTimestamp) || 0) - (Number(a.conversationTimestamp) || 0))
    .forEach((chat) => {
      const contactRecord = contactMap.get(normalizeJid(chat.id));
      buildRow(chat.id, chat, contactRecord);
    });

  const merged = mergePickerRows(rawRows);

  // Contact picker needs a dialable number — keep saved/name rows even if phone missing last
  const withPhone = merged.filter((row) => row.phoneNumber);
  const withoutPhone = merged.filter((row) => !row.phoneNumber && row.isSaved);

  return sortPickerContacts([...withPhone, ...withoutPhone]).slice(0, limit);
};

const createBaileysClientAdapter = (sock, { chatMap, contactMap }) => {
  const sendMessage = createSendMessage(sock);
  const phoneUser = String(sock?.user?.id || '').split('@')[0] || '';

  return {
    sock,
    sendMessage,
    chatMap,
    contactMap,
    info: {
      wid: {
        user: phoneUser
      }
    },
    getChatsForPicker: (limit) => getChatsForPicker(chatMap, contactMap, { limit }),
    end: async () => {
      try {
        sock.end(undefined);
      } catch {
        // ignore
      }
    },
    _healthCheckCleanup: () => {}
  };
};

module.exports = {
  toBaileysJid,
  extractMessageText,
  buildMediaContent,
  createSendMessage,
  wrapIncomingMessage,
  upsertChatRecord,
  upsertContactRecord,
  getChatsForPicker,
  hasPickerCandidates,
  normalizeJid,
  isPersonalChatJid,
  createBaileysClientAdapter
};
