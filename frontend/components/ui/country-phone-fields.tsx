'use client';

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { COUNTRIES, getCountry, searchCountries, type CountryOption } from '@dsb/shared';
import { cn } from '@/lib/utils';

function CountryListbox({
  id,
  value,
  onChange,
  labelledBy,
  placeholder,
  showDialCode,
}: {
  id: string;
  value: string;
  onChange: (iso: string) => void;
  labelledBy: string;
  placeholder: string;
  showDialCode: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = getCountry(value);
  const options = useMemo(() => searchCountries(query), [query]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function choose(row: CountryOption) {
    onChange(row.iso);
    setQuery('');
    setOpen(false);
  }

  function onKey(e: KeyboardEvent) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const row = options[active];
      if (row) choose(row);
    }
  }

  const summary = selected
    ? showDialCode
      ? `${selected.flag} ${selected.name} +${selected.dialCode}`
      : `${selected.flag} ${selected.name}`
    : placeholder;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        id={id}
        aria-labelledby={labelledBy}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex h-10 w-full items-center justify-between rounded-lg border border-border bg-white px-3 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onKey}
      >
        <span className="truncate">{summary}</span>
        <span className="ml-2 text-muted">▼</span>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[16rem] rounded-lg border border-border bg-white p-2 shadow-lg">
          <input
            ref={inputRef}
            className="mb-2 h-9 w-full rounded-md border border-border px-2 text-sm"
            placeholder="Search country, ISO, or +code"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKey}
            aria-label="Search countries"
          />
          <ul
            role="listbox"
            className="max-h-56 overflow-y-auto"
            aria-activedescendant={options[active] ? `${id}-opt-${options[active].iso}` : undefined}
          >
            {options.length === 0 && (
              <li className="px-2 py-2 text-sm text-muted">No matches</li>
            )}
            {options.map((row, index) => (
              <li key={row.iso} id={`${id}-opt-${row.iso}`} role="option" aria-selected={row.iso === value}>
                <button
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm',
                    index === active && 'bg-accent',
                    row.iso === value && 'font-medium',
                  )}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(row)}
                >
                  <span aria-hidden>{row.flag}</span>
                  <span className="flex-1 truncate">{row.name}</span>
                  <span className="text-xs text-muted">{row.iso}</span>
                  {showDialCode && <span className="text-xs text-muted">+{row.dialCode}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function CountrySelect({
  label = 'Country',
  value,
  onChange,
  required,
}: {
  label?: string;
  value: string;
  onChange: (iso: string) => void;
  required?: boolean;
}) {
  const uid = useId();
  const labelId = `${uid}-label`;
  return (
    <div className="space-y-1.5">
      <label id={labelId} className="block text-sm font-medium text-foreground">
        {label}
        {required ? ' *' : ''}
      </label>
      <CountryListbox
        id={`${uid}-country`}
        labelledBy={labelId}
        value={value}
        onChange={onChange}
        placeholder="Search country..."
        showDialCode={false}
      />
    </div>
  );
}

export function PhoneFields({
  phoneCountry,
  nationalNumber,
  onPhoneCountryChange,
  onNationalNumberChange,
  required,
}: {
  phoneCountry: string;
  nationalNumber: string;
  onPhoneCountryChange: (iso: string) => void;
  onNationalNumberChange: (value: string) => void;
  required?: boolean;
}) {
  const uid = useId();
  const labelId = `${uid}-phone-label`;
  return (
    <div className="space-y-1.5 sm:col-span-2">
      <label id={labelId} className="block text-sm font-medium text-foreground">
        Phone
        {required ? ' *' : ''}
      </label>
      <div className="grid gap-2 sm:grid-cols-[minmax(12rem,16rem)_1fr]">
        <CountryListbox
          id={`${uid}-phone-country`}
          labelledBy={labelId}
          value={phoneCountry}
          onChange={onPhoneCountryChange}
          placeholder="Phone country"
          showDialCode
        />
        <input
          className="flex h-10 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="Phone number"
          value={nationalNumber}
          required={required}
          aria-labelledby={labelId}
          onChange={(e) => onNationalNumberChange(e.target.value)}
        />
      </div>
    </div>
  );
}
