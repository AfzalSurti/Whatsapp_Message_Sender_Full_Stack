const MONTHS = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11
};

const pad = (value) => String(value).padStart(2, '0');

const parseTimePart = (text) => {
  const match = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  const meridiem = (match[3] || '').toLowerCase();

  if (meridiem === 'pm' && hours < 12) hours += 12;
  if (meridiem === 'am' && hours === 12) hours = 0;
  if (!meridiem && hours === 24) hours = 0;
  if (hours > 23 || minutes > 59) return null;

  return { hours, minutes };
};

const parseDatePart = (text, reference = new Date()) => {
  const lower = text.toLowerCase();

  if (/\btoday\b/.test(lower)) {
    return new Date(reference);
  }

  if (/\btomorrow\b/.test(lower)) {
    const date = new Date(reference);
    date.setDate(date.getDate() + 1);
    return date;
  }

  const isoMatch = lower.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (isoMatch) {
    return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
  }

  const slashMatch = lower.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (slashMatch) {
    const day = Number(slashMatch[1]);
    const month = Number(slashMatch[2]) - 1;
    let year = slashMatch[3] ? Number(slashMatch[3]) : reference.getFullYear();
    if (year < 100) year += 2000;
    return new Date(year, month, day);
  }

  const namedMatch = lower.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/);
  if (namedMatch) {
    const day = Number(namedMatch[1]);
    const month = MONTHS[namedMatch[2].slice(0, 3)];
    let year = reference.getFullYear();
    const candidate = new Date(year, month, day);
    if (candidate < new Date(reference.getFullYear(), reference.getMonth(), reference.getDate())) {
      year += 1;
    }
    return new Date(year, month, day);
  }

  const namedMatchAlt = lower.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?\b/);
  if (namedMatchAlt) {
    const month = MONTHS[namedMatchAlt[1].slice(0, 3)];
    const day = Number(namedMatchAlt[2]);
    let year = reference.getFullYear();
    const candidate = new Date(year, month, day);
    if (candidate < new Date(reference.getFullYear(), reference.getMonth(), reference.getDate())) {
      year += 1;
    }
    return new Date(year, month, day);
  }

  return null;
};

const parseRescheduleDateTime = (text, reference = new Date()) => {
  const raw = String(text || '').trim();
  if (!raw) return { error: 'Please share a date and time, for example: 17 May 3:30 PM' };

  const timePart = parseTimePart(raw);
  const datePart = parseDatePart(raw, reference);

  const base = datePart ? new Date(datePart) : new Date(reference);
  if (!datePart) {
    base.setFullYear(reference.getFullYear(), reference.getMonth(), reference.getDate());
  }

  if (!timePart) {
    return {
      error: 'Please include a time as well, for example: 17 May 3:30 PM or today 6:00 PM'
    };
  }

  base.setHours(timePart.hours, timePart.minutes, 0, 0);

  if (!datePart) {
    if (base <= reference) {
      base.setDate(base.getDate() + 1);
    }
  }

  const minTime = new Date(reference.getTime() + 6 * 60 * 1000);
  if (base <= minTime) {
    return { error: 'Please choose a time at least 6 minutes from now.' };
  }

  return { date: base };
};

const formatScheduleLabel = (date, timezone = 'Asia/Kolkata') =>
  date.toLocaleString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone
  });

module.exports = {
  parseRescheduleDateTime,
  formatScheduleLabel
};
