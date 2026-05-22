import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString
} from 'libphonenumber-js/min';

export const DEFAULT_PHONE_COUNTRY = 'IN';

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

export const normalizePhoneNumber = (value, country = DEFAULT_PHONE_COUNTRY) => {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const digits = digitsOnly(raw);
  const phone = raw.startsWith('+')
    ? parsePhoneNumberFromString(raw)
    : parsePhoneNumberFromString(digits, country);

  if (!phone?.isValid()) return null;

  return {
    e164: phone.number,
    country: phone.country || country,
    nationalNumber: phone.nationalNumber,
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
  return `+${option.dialCode} 123456789`;
};
