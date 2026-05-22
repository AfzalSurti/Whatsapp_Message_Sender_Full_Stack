'use client';

import { useEffect, useMemo, useState } from 'react';
import { PhoneInput } from 'react-international-phone';
import {
  DEFAULT_PHONE_COUNTRY,
  normalizePhoneNumber,
  getPhonePlaceholder
} from '@/lib/phone';

export default function InternationalPhoneInput({
  label,
  value,
  onChange,
  defaultCountry = DEFAULT_PHONE_COUNTRY,
  placeholder,
  error,
  helperText,
  required = false,
  disabled = false,
  onBlur,
  onCountryChange,
  inputClassName = '',
  className = ''
}) {
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!value) {
      setTouched(false);
    }
  }, [value]);

  const validationError = useMemo(() => {
    if (!value) return required ? 'Phone number is required' : '';
    return normalizePhoneNumber(value, defaultCountry) ? '' : 'Enter a valid international phone number';
  }, [defaultCountry, required, value]);

  const displayError = error || (touched ? validationError : '');
  const resolvedPlaceholder = placeholder || getPhonePlaceholder(defaultCountry);

  return (
    <div className={className}>
      {label && (
        <label className="mb-2 block text-sm font-medium text-gray-200">
          {label}
        </label>
      )}

      <PhoneInput
        defaultCountry={defaultCountry.toLowerCase()}
        value={value}
        onChange={(phone, meta) => {
          onChange?.(phone, meta);
          onCountryChange?.(meta?.country?.iso2?.toUpperCase() || defaultCountry);
        }}
        onBlur={(event) => {
          setTouched(true);
          onBlur?.(event);
        }}
        placeholder={resolvedPlaceholder}
        disabled={disabled}
        forceDialCode
        disableDialCodePrefill={false}
        hideDropdown={false}
        inputClassName={`!w-full !h-11 !rounded-xl !border !border-white/10 !bg-[#0a0a0a] !px-4 !py-2.5 !text-sm !text-white !placeholder-gray-600 !outline-none focus:!border-[#25D366] ${inputClassName}`}
        countrySelectorStyleProps={{
          buttonClassName: '!rounded-l-xl !border-white/10 !bg-[#0a0a0a] !text-white',
          dropdownStyle: { zIndex: 60 },
          buttonStyle: { height: 44 }
        }}
        inputStyle={{ width: '100%' }}
      />

      {(displayError || helperText) && (
        <p className={`mt-2 text-xs ${displayError ? 'text-red-400' : 'text-gray-400'}`}>
          {displayError || helperText}
        </p>
      )}
    </div>
  );
}
