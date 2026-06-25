const { parsePhoneNumberFromString } = require('libphonenumber-js/min');

const DEFAULT_PHONE_COUNTRY = 'IN';
const IN_MOBILE_PATTERN = /^[6-9]\d{9}$/;

const isE164 = (value) => /^\+[1-9]\d{7,14}$/.test(String(value || '').trim());

const containsInvalidPhoneCharacters = (value) => /[a-zA-Z]/.test(String(value || ''));

const isValidIndianMobileDigits = (nationalNumber) => IN_MOBILE_PATTERN.test(String(nationalNumber || ''));

const getPhoneValidationError = (country = DEFAULT_PHONE_COUNTRY) => {
  if (country === 'IN') {
    return 'Enter a valid 10-digit mobile number (digits only, starting with 6-9)';
  }
  return 'Enter a valid international phone number';
};

const normalizePhoneNumber = (value, country = DEFAULT_PHONE_COUNTRY) => {
  const raw = String(value || '').trim();
  if (!raw) return null;

  if (containsInvalidPhoneCharacters(raw)) return null;

  const digitsOnly = raw.replace(/\D/g, '');

  // Reject non-numeric local input before parsing.
  if (!raw.startsWith('+') && digitsOnly !== raw.replace(/[\s()-]/g, '')) {
    return null;
  }

  const parsed = raw.startsWith('+')
    ? parsePhoneNumberFromString(raw)
    : parsePhoneNumberFromString(digitsOnly, country);

  if (!parsed?.isValid()) return null;

  const resolvedCountry = parsed.country || country;
  const nationalNumber = parsed.nationalNumber;

  if (resolvedCountry === 'IN' && !isValidIndianMobileDigits(nationalNumber)) {
    return null;
  }

  return {
    e164: parsed.number,
    country: resolvedCountry,
    nationalNumber,
    displayNumber: parsed.formatInternational()
  };
};

const normalizePhoneList = (numbers, country = DEFAULT_PHONE_COUNTRY) => {
  if (!Array.isArray(numbers)) {
    return { valid: false, error: 'Phone numbers must be provided as an array' };
  }

  if (numbers.length === 0) {
    return { valid: false, error: 'Provide at least one phone number' };
  }

  if (numbers.length > 500) {
    return { valid: false, error: 'Maximum 500 phone numbers allowed per request' };
  }

  const normalizedNumbers = [];
  const seen = new Set();

  for (const raw of numbers) {
    if (raw === null || raw === undefined) {
      return { valid: false, error: 'Each phone number must be a valid value' };
    }

    const normalized = normalizePhoneNumber(String(raw).trim(), country);
    if (!normalized) {
      return {
        valid: false,
        error: getPhoneValidationError(country)
      };
    }

    const key = normalized.nationalNumber;
    if (seen.has(key)) continue;

    seen.add(key);
    normalizedNumbers.push(normalized.e164);
  }

  if (normalizedNumbers.length === 0) {
    return { valid: false, error: 'No valid phone numbers provided' };
  }

  return { valid: true, numbers: normalizedNumbers };
};

module.exports = {
  DEFAULT_PHONE_COUNTRY,
  IN_MOBILE_PATTERN,
  isE164,
  containsInvalidPhoneCharacters,
  isValidIndianMobileDigits,
  getPhoneValidationError,
  normalizePhoneNumber,
  normalizePhoneList
};
