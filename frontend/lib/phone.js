import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString
} from 'libphonenumber-js/min';

export const DEFAULT_PHONE_COUNTRY = 'IN';
export const IN_MOBILE_PATTERN = /^[6-9]\d{9}$/;

const regionNames = typeof Intl !== 'undefined' && Intl.DisplayNames
  ? new Intl.DisplayNames(['en'], { type: 'region' })
  : null;

export const COUNTRY_OPTIONS = getCountries()
  .map((code) => ({
    code,
    name: regionNames?.of(code) || code,
    dialCode: getCountryCallingCode(code)
  }))
  .sort((a, b) => {
    if (a.code === DEFAULT_PHONE_COUNTRY) return -1;
    if (b.code === DEFAULT_PHONE_COUNTRY) return 1;
    return a.name.localeCompare(b.name);
  });

export const digitsOnly = (value) => String(value || '').replace(/\D/g, '');

export const getCountryOption = (countryCode) =>
  COUNTRY_OPTIONS.find((country) => country.code === countryCode);

export const containsInvalidPhoneCharacters = (value) => /[a-zA-Z]/.test(String(value || ''));

export const isValidIndianMobileDigits = (nationalNumber) =>
  IN_MOBILE_PATTERN.test(String(nationalNumber || ''));

export const getPhoneValidationError = (country = DEFAULT_PHONE_COUNTRY) => {
  if (country === 'IN') {
    return 'Enter a valid 10-digit mobile number (digits only, starting with 6-9)';
  }
  return 'Enter a valid international phone number';
};

export const normalizePhoneNumber = (value, country = DEFAULT_PHONE_COUNTRY) => {
  const raw = String(value || '').trim();
  if (!raw) return null;

  if (containsInvalidPhoneCharacters(raw)) return null;

  const digits = digitsOnly(raw);

  if (!raw.startsWith('+') && digits !== raw.replace(/[\s()-]/g, '')) {
    return null;
  }

  const phone = raw.startsWith('+')
    ? parsePhoneNumberFromString(raw)
    : parsePhoneNumberFromString(digits, country);

  if (!phone?.isValid()) return null;

  const resolvedCountry = phone.country || country;
  const nationalNumber = phone.nationalNumber;

  if (resolvedCountry === 'IN' && !isValidIndianMobileDigits(nationalNumber)) {
    return null;
  }

  return {
    e164: phone.number,
    country: resolvedCountry,
    nationalNumber,
    displayNumber: phone.formatInternational()
  };
};

export const formatPhoneNumber = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '-';

  const parsed = raw.startsWith('+')
    ? parsePhoneNumberFromString(raw)
    : parsePhoneNumberFromString(digitsOnly(raw), DEFAULT_PHONE_COUNTRY);

  return parsed?.isValid() ? parsed.formatInternational() : raw;
};

export const getPhonePlaceholder = (countryCode = DEFAULT_PHONE_COUNTRY) => {
  const option = getCountryOption(countryCode);
  if (!option) return 'Phone number';
  if (countryCode === 'IN') return '10-digit mobile number';
  return `+${option.dialCode} phone number`;
};
