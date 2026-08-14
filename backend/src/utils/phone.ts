import { getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';
import { dialCodeFor } from '@dsb/shared';

export class PhoneError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

const COUNTRY_RE = /^[A-Z]{2}$/;

/** ISO country for business location or phone — never derived from the other field. */
export function normalizeCountry(country?: string, fallback = 'IN'): CountryCode {
  const value = (country ?? fallback).trim().toUpperCase();
  if (!COUNTRY_RE.test(value)) {
    throw new PhoneError('VALIDATION_ERROR', 'Country must be a 2-letter ISO code');
  }
  return value as CountryCode;
}

export function callingCodeFor(iso: CountryCode): string {
  try {
    return String(getCountryCallingCode(iso));
  } catch {
    return dialCodeFor(iso) ?? '';
  }
}

export function normalizePhone(
  raw: string,
  phoneCountry?: string,
): { e164: string; digits: string; phoneCountry: CountryCode; dialCode: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new PhoneError('INVALID_PHONE', 'Phone number is required');
  }

  const defaultIso = normalizeCountry(phoneCountry);
  const parsed =
    parsePhoneNumberFromString(trimmed, defaultIso) ??
    parsePhoneNumberFromString(trimmed.replace(/\D/g, ''), defaultIso);

  if (!parsed?.isValid()) {
    throw new PhoneError('INVALID_PHONE', 'Enter a valid phone number');
  }

  const e164 = parsed.number;
  const iso = (parsed.country ?? defaultIso) as CountryCode;
  return {
    e164,
    digits: e164.replace(/\D/g, ''),
    phoneCountry: iso,
    dialCode: callingCodeFor(iso),
  };
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
