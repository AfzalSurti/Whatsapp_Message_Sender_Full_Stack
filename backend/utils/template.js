const ALLOWED_VARIABLES = new Set([
  'name',
  'phone',
  'segment',
  'due_date',
  'offer_code',
  'city',
  'link'
]);

const CONTACT_VARIABLES = new Set(['name', 'phone', 'segment']);

const TEMPLATE_DEFAULT_VARIABLES = new Set(['due_date', 'offer_code', 'city', 'link']);

const SCHEDULE_REQUIRED_VARIABLES = new Set(['due_date', 'offer_code', 'city', 'link']);

const VARIABLE_REGEX = /\{\{(\w+)\}\}/g;

const extractVariables = (body = '') => {
  const vars = new Set();
  const matches = body.matchAll(VARIABLE_REGEX);
  for (const match of matches) {
    vars.add(match[1]);
  }
  return [...vars];
};

const validateTemplateBody = (body = '') => {
  const trimmed = String(body).trim();
  if (trimmed.length < 10) {
    return { valid: false, error: 'Template message must be at least 10 characters' };
  }
  if (trimmed.length > 4096) {
    return { valid: false, error: 'Template message must be 4096 characters or less' };
  }

  const variables = extractVariables(trimmed);
  const invalid = variables.filter((v) => !ALLOWED_VARIABLES.has(v));
  if (invalid.length > 0) {
    return {
      valid: false,
      error: `Unsupported variables: ${invalid.map((v) => `{{${v}}}`).join(', ')}. Allowed: ${[...ALLOWED_VARIABLES].map((v) => `{{${v}}}`).join(', ')}`
    };
  }

  return { valid: true, variables };
};

const normalizeDefaultVariables = (defaultVariables = {}) => {
  if (!defaultVariables || typeof defaultVariables !== 'object') return {};

  return Object.fromEntries(
    Object.entries(defaultVariables)
      .map(([key, value]) => [String(key).trim(), String(value ?? '').trim()])
      .filter(([key]) => key)
  );
};

const validateTemplateDefaults = (body = '', defaultVariables = {}) => {
  const bodyCheck = validateTemplateBody(body);
  if (!bodyCheck.valid) {
    return bodyCheck;
  }

  const defaults = normalizeDefaultVariables(defaultVariables);
  const missing = bodyCheck.variables
    .filter((variable) => TEMPLATE_DEFAULT_VARIABLES.has(variable))
    .filter((variable) => !defaults[variable]);

  if (missing.length > 0) {
    return {
      valid: false,
      error: `Set default values for: ${missing.map((v) => `{{${v}}}`).join(', ')}`
    };
  }

  return { valid: true, variables: bodyCheck.variables, defaultVariables: defaults };
};

const validateScheduleVariables = (body, templateVariables = {}, recipients = []) => {
  const bodyCheck = validateTemplateBody(body);
  if (!bodyCheck.valid) {
    return bodyCheck;
  }

  const variables = bodyCheck.variables;
  const missingStatic = variables
    .filter((v) => SCHEDULE_REQUIRED_VARIABLES.has(v))
    .filter((v) => !String(templateVariables[v] || '').trim());

  if (missingStatic.length > 0) {
    return {
      valid: false,
      error: `Provide values for: ${missingStatic.map((v) => `{{${v}}}`).join(', ')}`
    };
  }

  if (variables.includes('name')) {
    const unnamed = recipients.filter((r) => !String(r.name || '').trim());
    if (unnamed.length > 0) {
      return {
        valid: false,
        error: `Template uses {{name}} but ${unnamed.length} recipient(s) have no name. Add names to contacts or choose a different template.`
      };
    }
  }

  return { valid: true, variables };
};

const applyTemplate = (body = '', values = {}) => {
  return String(body).replace(VARIABLE_REGEX, (match, key) => {
    const value = values[key];
    if (value === undefined || value === null || String(value).trim() === '') {
      return match;
    }
    return String(value);
  });
};

const buildRecipientMessage = (body, recipient, templateVariables = {}) => {
  return applyTemplate(body, {
    name: recipient.name || '',
    phone: recipient.phone || '',
    segment: recipient.segment || '',
    due_date: templateVariables.due_date || '',
    offer_code: templateVariables.offer_code || '',
    city: templateVariables.city || '',
    link: templateVariables.link || ''
  });
};

module.exports = {
  ALLOWED_VARIABLES,
  CONTACT_VARIABLES,
  TEMPLATE_DEFAULT_VARIABLES,
  SCHEDULE_REQUIRED_VARIABLES,
  extractVariables,
  validateTemplateBody,
  validateTemplateDefaults,
  validateScheduleVariables,
  applyTemplate,
  buildRecipientMessage,
  normalizeDefaultVariables
};
