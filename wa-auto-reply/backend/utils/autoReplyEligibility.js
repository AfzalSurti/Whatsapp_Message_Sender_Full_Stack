const ContactGroup = require('../models/ContactGroup');
const { isContactSelected, isChatId } = require('./whatsappChat');

const extractDigits = (value = '') => String(value || '').replace(/\D/g, '');

const phonesMatch = (a, b) => {
  const left = extractDigits(a);
  const right = extractDigits(b);
  if (!left || !right) return false;
  return left === right || left.endsWith(right) || right.endsWith(left);
};

const buildSavedPhoneSet = async (userId) => {
  const groups = await ContactGroup.find({ userId }).lean();
  const phones = new Set();

  for (const group of groups) {
    for (const entry of group.numbers || []) {
      const digits = extractDigits(entry.phone);
      if (digits) phones.add(digits);
    }
  }

  return phones;
};

const isInSavedContacts = (contactPhone, chatId, savedPhones) => {
  if (!savedPhones?.size) return false;

  if (contactPhone) {
    for (const saved of savedPhones) {
      if (phonesMatch(contactPhone, saved)) return true;
    }
  }

  if (chatId && isChatId(chatId)) {
    const chatUser = chatId.split('@')[0];
    for (const saved of savedPhones) {
      if (phonesMatch(chatUser, saved)) return true;
    }
  }

  return false;
};

const resolveAutoReplyAccess = ({ config, chatId, contactPhone, savedPhones }) => {
  const isSelected = isContactSelected(config?.selectedContacts || [], chatId, contactPhone);
  const isUnknown = !isInSavedContacts(contactPhone, chatId, savedPhones);

  if (config?.mode === 'selected') {
    return {
      allowed: isSelected,
      isSelected,
      isUnknown: false,
      useAllTemplates: false,
      reason: isSelected ? 'selected' : 'not_selected'
    };
  }

  if (config?.mode === 'all') {
    return {
      allowed: true,
      isSelected: false,
      isUnknown: false,
      useAllTemplates: true,
      reason: 'all_messages'
    };
  }

  // smart (default): new numbers + selected WhatsApp chats
  const allowed = isUnknown || isSelected;

  return {
    allowed,
    isSelected,
    isUnknown,
    useAllTemplates: isUnknown,
    reason: allowed ? (isUnknown ? 'unknown_number' : 'selected_chat') : 'saved_contact_not_selected'
  };
};

module.exports = {
  buildSavedPhoneSet,
  isInSavedContacts,
  resolveAutoReplyAccess
};
