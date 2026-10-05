const validator = require('validator');

const EMAIL_RULES = {
  maxLength: 254,
  localPartMinLength: 1,
  localPartMaxLength: 64,
  localPartPattern: /^[a-z0-9]+(?:[._%+-][a-z0-9]+)*$/,
  strictLocalPartMinLength: 6,
  strictLocalPartMaxLength: 30,
  strictLocalPartPattern: /^[a-z0-9]+(?:\.[a-z0-9]+)*$/,
  strictDomains: ['gmail.com', 'googlemail.com'],
  tldPattern: /^[a-z]{2,}$/
};

const PHONE_RULES = {
  minDigits: 7,
  maxDigits: 15,
  separatorsPattern: /[\s\-().]/g
};

function splitEmail(email) {
  const value = (email || '').trim().toLowerCase();
  const atIndex = value.lastIndexOf('@');
  if (atIndex < 0) {
    return null;
  }
  return {
    value,
    localPart: value.slice(0, atIndex),
    domain: value.slice(atIndex + 1)
  };
}

function isStrictEmailDomain(domain) {
  return EMAIL_RULES.strictDomains.includes(domain);
}

function hasValidDomain(domain) {
  if (!domain || domain.length > 255 || domain.includes('..')) {
    return false;
  }
  if (!validator.isFQDN(domain, { require_tld: true, allow_underscores: false })) {
    return false;
  }
  const tld = domain.slice(domain.lastIndexOf('.') + 1);
  return EMAIL_RULES.tldPattern.test(tld);
}

function hasValidLocalPart(localPart, strict) {
  if (localPart.startsWith('.') || localPart.endsWith('.')) {
    return false;
  }

  if (strict) {
    if (
      localPart.length < EMAIL_RULES.strictLocalPartMinLength ||
      localPart.length > EMAIL_RULES.strictLocalPartMaxLength
    ) {
      return false;
    }
    return EMAIL_RULES.strictLocalPartPattern.test(localPart);
  }

  if (
    localPart.length < EMAIL_RULES.localPartMinLength ||
    localPart.length > EMAIL_RULES.localPartMaxLength
  ) {
    return false;
  }
  return EMAIL_RULES.localPartPattern.test(localPart);
}

function isValidEmail(email) {
  const parts = splitEmail(email);
  if (!parts) {
    return false;
  }

  if (parts.value.length > EMAIL_RULES.maxLength || /\s/.test(parts.value)) {
    return false;
  }

  if (!validator.isEmail(parts.value, { allow_utf8_local_part: false })) {
    return false;
  }

  const strict = isStrictEmailDomain(parts.domain);

  return hasValidLocalPart(parts.localPart, strict) && hasValidDomain(parts.domain);
}

function normalizeEmail(email) {
  const parts = splitEmail(email);
  if (parts) {
    return parts.value;
  }
  return (email || '').trim().toLowerCase();
}

function normalizeEmailForComparison(email) {
  const parts = splitEmail(email);
  if (!parts) {
    return '';
  }
  return isStrictEmailDomain(parts.domain)
    ? `${parts.localPart.replace(/\./g, '')}@${parts.domain}`
    : parts.value;
}

function normalizePhone(phone) {
  return (phone || '').trim().replace(PHONE_RULES.separatorsPattern, '');
}

function isValidPhone(phone) {
  const value = normalizePhone(phone);
  if (!value) {
    return false;
  }

  const isInternational = value.startsWith('+');
  const digits = isInternational ? value.slice(1) : value;

  if (!/^\d+$/.test(digits)) {
    return false;
  }

  if (digits.length < PHONE_RULES.minDigits || digits.length > PHONE_RULES.maxDigits) {
    return false;
  }

  if (!isInternational) {
    return true;
  }

  return validator.isMobilePhone(value, 'any');
}

module.exports = {
  EMAIL_RULES,
  PHONE_RULES,
  isValidEmail,
  isValidPhone,
  normalizeEmail,
  normalizeEmailForComparison,
  normalizePhone
};