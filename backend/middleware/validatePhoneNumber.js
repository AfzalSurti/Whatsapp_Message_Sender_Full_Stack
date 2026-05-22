const { normalizePhoneNumber } = require('../utils/phone');

const buildPhoneError = (field, message) => ({
  type: 'field',
  value: undefined,
  msg: message,
  path: field,
  location: 'body'
});

const validateAndNormalizePhoneField = ({
  field,
  countryField = 'country',
  requiredMessage = 'Phone number is required',
  invalidMessage = 'Enter a valid international phone number'
}) => {
  return (req, res, next) => {
    const rawValue = req.body?.[field];

    if (!String(rawValue || '').trim()) {
      return res.status(400).json({ errors: [buildPhoneError(field, requiredMessage)] });
    }

    const normalized = normalizePhoneNumber(rawValue, req.body?.[countryField]);
    if (!normalized) {
      return res.status(400).json({ errors: [buildPhoneError(field, invalidMessage)] });
    }

    req.body[field] = normalized.e164;
    next();
  };
};

module.exports = { validateAndNormalizePhoneField };
