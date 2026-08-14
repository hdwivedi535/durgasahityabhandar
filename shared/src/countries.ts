import { COUNTRY_RECORDS, type CountryRecord } from './country-data';

export type { CountryRecord };

export interface CountryOption extends CountryRecord {
  flag: string;
}

export function flagEmoji(iso: string): string {
  const code = iso.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return '';
  return String.fromCodePoint(...[...code].map((ch) => 127397 + ch.charCodeAt(0)));
}

export function toCountryOption(row: CountryRecord): CountryOption {
  return { ...row, flag: flagEmoji(row.iso) };
}

export const COUNTRIES: CountryOption[] = COUNTRY_RECORDS.map(toCountryOption);

const byIso = new Map(COUNTRIES.map((row) => [row.iso, row]));

export function getCountry(iso?: string): CountryOption | undefined {
  if (!iso) return undefined;
  return byIso.get(iso.trim().toUpperCase());
}

export function dialCodeFor(iso?: string): string | undefined {
  return getCountry(iso)?.dialCode;
}

export function nationalNumberFromE164(e164: string, isoOrDial?: string): string {
  const digits = e164.replace(/\D/g, '');
  const dial = getCountry(isoOrDial)?.dialCode ?? isoOrDial?.replace(/\D/g, '');
  if (dial && digits.startsWith(dial)) return digits.slice(dial.length);
  return digits;
}

/** Search by country name, ISO code, or dial code (+91, 91, IN). */
export function searchCountries(query: string, list: CountryOption[] = COUNTRIES): CountryOption[] {
  const q = query.trim().toLowerCase().replace(/^\+/, '');
  if (!q) return list;
  return list.filter((row) => {
    return (
      row.name.toLowerCase().includes(q) ||
      row.iso.toLowerCase() === q ||
      row.iso.toLowerCase().startsWith(q) ||
      row.dialCode === q ||
      row.dialCode.startsWith(q)
    );
  });
}
