export const ALLOWED_VARIABLES = ['name', 'phone', 'segment', 'due_date', 'offer_code', 'city'];

export const SCHEDULE_REQUIRED_VARIABLES = ['due_date', 'offer_code', 'city'];

const VARIABLE_REGEX = /\{\{(\w+)\}\}/g;

export const extractVariables = (body = '') => {
  const vars = new Set();
  const matches = String(body).matchAll(VARIABLE_REGEX);
  for (const match of matches) {
    vars.add(match[1]);
  }
  return [...vars];
};

export const getMissingScheduleVariables = (body = '', templateVariables = {}) => {
  return extractVariables(body).filter(
    (variable) =>
      SCHEDULE_REQUIRED_VARIABLES.includes(variable) &&
      !String(templateVariables[variable] || '').trim()
  );
};

export const validateScheduleOnClient = (body, templateVariables = {}, recipients = []) => {
  const missingStatic = getMissingScheduleVariables(body, templateVariables);
  if (missingStatic.length > 0) {
    return `Provide values for: ${missingStatic.map((v) => `{{${v}}}`).join(', ')}`;
  }

  if (extractVariables(body).includes('name')) {
    const unnamed = recipients.filter((recipient) => !String(recipient.name || '').trim());
    if (unnamed.length > 0) {
      return `Template uses {{name}} but ${unnamed.length} recipient(s) have no name.`;
    }
  }

  return null;
};

export const applyTemplatePreview = (body = '', values = {}) => {
  return String(body).replace(VARIABLE_REGEX, (match, key) => {
    const value = values[key];
    if (value === undefined || value === null || String(value).trim() === '') {
      return match;
    }
    return String(value);
  });
};

export const variableLabel = (variable) => {
  const labels = {
    name: 'Contact name',
    phone: 'Phone number',
    segment: 'Group / segment',
    due_date: 'Due date',
    offer_code: 'Offer code',
    city: 'City'
  };
  return labels[variable] || variable;
};
