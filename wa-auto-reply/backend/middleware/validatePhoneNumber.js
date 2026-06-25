const { normalizePhoneNumber, getPhoneValidationError } = require('../utils/phone');

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
  invalidMessage
}) => {
  return (req, res, next) => {
    const rawValue = req.body?.[field];
    const country = req.body?.[countryField];

    if (!String(rawValue || '').trim()) {
      return res.status(400).json({ errors: [buildPhoneError(field, requiredMessage)] });
    }

    const normalized = normalizePhoneNumber(rawValue, country);
    if (!normalized) {
      return res.status(400).json({
        errors: [buildPhoneError(field, invalidMessage || getPhoneValidationError(country))]
      });
    }

    req.body[field] = normalized.e164;
    next();
  };
};

module.exports = { validateAndNormalizePhoneField };
