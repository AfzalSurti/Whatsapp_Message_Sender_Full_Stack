const { parsePhoneNumberFromString } = require('libphonenumber-js/min');

const DEFAULT_PHONE_COUNTRY = 'IN';

const isE164 = (value) => /^\+[1-9]\d{7,14}$/.test(String(value || '').trim());

const normalizePhoneNumber = (value, country = DEFAULT_PHONE_COUNTRY) => {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const parsed = raw.startsWith('+')
    ? parsePhoneNumberFromString(raw)
    : parsePhoneNumberFromString(raw.replace(/\D/g, ''), country);

  if (!parsed?.isValid()) return null;

  return {
    e164: parsed.number,
    country: parsed.country || country,
    nationalNumber: parsed.nationalNumber,
    displayNumber: parsed.formatInternational()
  };
};

module.exports = {
  DEFAULT_PHONE_COUNTRY,
  isE164,
  normalizePhoneNumber
};
