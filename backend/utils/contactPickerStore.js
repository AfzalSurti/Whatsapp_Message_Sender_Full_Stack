const {
  normalizeJid,
  isPersonalChatJid,
  buildLidPhoneMap
} = require('./baileysAdapter');
const {
  normalizePhoneValue,
  extractDigits,
  classifyPickerContact,
  sortPickerContacts,
  mergePickerRows,
  pickContactDisplayName
} = require('./whatsappChat');

const upsertContactPickerRecord = (store, contact = {}) => {
  const jid = normalizeJid(contact.id);
  if (!jid || jid.endsWith('@g.us') || !isPersonalChatJid(jid)) return;

  const existing = store.get(jid) || {};
  const server = jid.split('@')[1] || '';
  let phoneNumber = existing.phoneNumber || '';

  if (server === 's.whatsapp.net' || server === 'c.us') {
    const normalized = normalizePhoneValue(jid.split('@')[0]);
    if (normalized) phoneNumber = normalized;
  }

  const name =
    String(contact.name || '').trim() ||
    String(contact.notify || '').trim() ||
    String(contact.verifiedName || '').trim() ||
    existing.name ||
    '';

  store.set(jid, {
    chatId: jid,
    jid,
    name,
    phoneNumber,
    notify: contact.notify || existing.notify || '',
    lid: contact.lid || existing.lid,
    source: 'whatsapp'
  });
};

const applyLidPhoneMapToStore = (store, lidPhoneMap = new Map()) => {
  lidPhoneMap.forEach((phone, lidJid) => {
    const normalizedLid = normalizeJid(lidJid);
    const existing = store.get(normalizedLid);
    if (!existing) return;

    const normalizedPhone = normalizePhoneValue(phone);
    if (normalizedPhone) {
      store.set(normalizedLid, { ...existing, phoneNumber: normalizedPhone });
    }
  });
};

const contactsFromPickerStore = (
  store,
  { limit = 500, excludePhoneDigits = '', lidPhoneMap = null, contactMap = null } = {}
) => {
  const lidMap = lidPhoneMap || (contactMap ? buildLidPhoneMap(contactMap) : new Map());
  applyLidPhoneMapToStore(store, lidMap);

  const selfDigits = String(excludePhoneDigits || '').replace(/\D/g, '');
  const rawRows = [];

  store.forEach((record) => {
    const chatId = normalizeJid(record.chatId || record.jid);
    if (!chatId || !isPersonalChatJid(chatId)) return;

    let phoneNumber = record.phoneNumber || '';
    if (!phoneNumber && chatId.endsWith('@lid')) {
      phoneNumber = lidMap.get(chatId) || '';
    }

    const contactRecord = contactMap?.get(chatId) || null;
    const name =
      pickContactDisplayName(
        contactRecord
          ? {
              name: contactRecord.name,
              pushname: contactRecord.notify,
              verifiedName: contactRecord.verifiedName
            }
          : null,
        { pushName: record.notify || record.name },
        phoneNumber || chatId.split('@')[0]
      ) || record.name || '';

    const { isSaved, hasDisplayName, sortRank } = classifyPickerContact(
      name,
      contactRecord,
      phoneNumber
    );

    rawRows.push({
      chatId,
      name,
      phoneNumber: phoneNumber && !String(phoneNumber).includes('@') ? phoneNumber : '',
      source: 'whatsapp',
      isSaved,
      hasDisplayName,
      sortRank
    });
  });

  const merged = mergePickerRows(rawRows);
  const filtered = merged.filter((row) => {
    if (!selfDigits) return true;
    return extractDigits(row.phoneNumber || '') !== selfDigits;
  });

  const withPhone = filtered.filter((row) => row.phoneNumber);
  const withoutPhone = filtered.filter((row) => !row.phoneNumber);

  return sortPickerContacts([...withPhone, ...withoutPhone]).slice(0, limit);
};

module.exports = {
  upsertContactPickerRecord,
  contactsFromPickerStore,
  applyLidPhoneMapToStore
};
