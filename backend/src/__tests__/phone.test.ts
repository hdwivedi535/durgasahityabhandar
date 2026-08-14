import { describe, expect, it } from 'vitest';
import { PhoneError, normalizeCountry, normalizeEmail, normalizePhone } from '../utils/phone';

describe('normalizePhone', () => {
  it('normalizes Indian numbers with country IN to the same E.164 pair', () => {
    const a = normalizePhone('9876543210', 'IN');
    const b = normalizePhone('+91 98765 43210', 'in');
    const c = normalizePhone('09876543210', 'IN');
    expect(a.e164).toBe('+919876543210');
    expect(a.digits).toBe('919876543210');
    expect(a.phoneCountry).toBe('IN');
    expect(a.dialCode).toBe('91');
    expect(b).toEqual(a);
    expect(c).toEqual(a);
  });

  it('validates Nepal vs India phone independently of business country', () => {
    const inNumber = normalizePhone('9841234567', 'IN');
    const npNumber = normalizePhone('9841234567', 'NP');
    expect(inNumber.e164).not.toBe(npNumber.e164);
    expect(inNumber.phoneCountry).toBe('IN');
    expect(npNumber.phoneCountry).toBe('NP');
    expect(npNumber.dialCode).toBe('977');
  });

  it('rejects invalid phone with INVALID_PHONE', () => {
    try {
      normalizePhone('12', 'IN');
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(PhoneError);
      expect((err as PhoneError).code).toBe('INVALID_PHONE');
      expect((err as PhoneError).message).toMatch(/valid phone/i);
    }
  });

  it('rejects missing phone', () => {
    try {
      normalizePhone('  ', 'IN');
      throw new Error('expected throw');
    } catch (err) {
      expect((err as PhoneError).code).toBe('INVALID_PHONE');
    }
  });
});

describe('normalizeCountry / email', () => {
  it('defaults country to IN and uppercases', () => {
    expect(normalizeCountry(undefined)).toBe('IN');
    expect(normalizeCountry('np')).toBe('NP');
  });

  it('rejects bad country codes', () => {
    try {
      normalizeCountry('IND');
      throw new Error('expected throw');
    } catch (err) {
      expect((err as PhoneError).code).toBe('VALIDATION_ERROR');
    }
  });

  it('normalizes email to lowercase trim', () => {
    expect(normalizeEmail('  Ada@Example.COM ')).toBe('ada@example.com');
    expect(normalizeEmail('')).toBeUndefined();
    expect(normalizeEmail(undefined)).toBeUndefined();
  });
});
