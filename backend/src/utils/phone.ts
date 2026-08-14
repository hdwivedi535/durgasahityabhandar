import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';

export class PhoneError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

const COUNTRY_RE = /^[A-Z]{2}$/;

export function normalizeCountry(country?: string): CountryCode {
  const value = (country ?? 'IN').trim().toUpperCase();
  if (!COUNTRY_RE.test(value)) {
    throw new PhoneError('VALIDATION_ERROR', 'Country must be a 2-letter ISO code');
  }
  return value as CountryCode;
}

export function normalizePhone(
  raw: string,
  country?: string,
): { e164: string; digits: string; country: CountryCode } {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new PhoneError('INVALID_PHONE', 'Phone number is required');
  }

  const iso = normalizeCountry(country);
  const parsed = parsePhoneNumberFromString(trimmed, iso);
  if (parsed?.isValid()) {
    const e164 = parsed.number;
    return { e164, digits: e164.replace(/\D/g, ''), country: iso };
  }

  const digitsOnly = trimmed.replace(/\D/g, '');
  const retry = parsePhoneNumberFromString(digitsOnly, iso);
  if (retry?.isValid()) {
    const e164 = retry.number;
    return { e164, digits: e164.replace(/\D/g, ''), country: iso };
  }

  throw new PhoneError('INVALID_PHONE', 'Enter a valid phone number');
}

export function normalizeEmail(email?: string): string | undefined {
  const value = email?.trim().toLowerCase();
  return value ? value : undefined;
}

export function businessNameScore(a: string, b: string): number {
  const left = a.trim().toLowerCase();
  const right = b.trim().toLowerCase();
  if (!left || !right) return 0;
  if (left === right) return 40;
  if (left.includes(right) || right.includes(left)) return 20;
  return 0;
}
