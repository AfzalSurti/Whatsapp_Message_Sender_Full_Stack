const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const validateEmail = (email) => {
  const value = String(email || '').trim();
  if (!value) return 'Email is required';
  if (value.length > 254) return 'Email is too long';
  if (!EMAIL_PATTERN.test(value)) return 'Enter a valid email address';
  return '';
};

export const validatePassword = (password, { minLength = 6, maxLength = 128 } = {}) => {
  const value = String(password || '');
  if (!value) return 'Password is required';
  if (value.length < minLength) return `Password must be at least ${minLength} characters`;
  if (value.length > maxLength) return `Password must be ${maxLength} characters or less`;
  return '';
};

export const validateName = (name, { minLength = 2, maxLength = 80 } = {}) => {
  const value = String(name || '').trim();
  if (!value) return 'Name is required';
  if (value.length < minLength) return `Name must be at least ${minLength} characters`;
  if (value.length > maxLength) return `Name must be ${maxLength} characters or less`;
  return '';
};

export const validateRequiredText = (value, label, maxLength = 500) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return `${label} is required`;
  if (trimmed.length > maxLength) return `${label} must be ${maxLength} characters or less`;
  return '';
};
