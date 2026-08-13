'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export const PUBLIC_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'sa', label: 'संस्कृत' },
  { code: 'ne', label: 'नेपाली' },
] as const;

const KEY = 'dsb_lang';

interface PublicLangValue {
  lang: string;
  setLang: (code: string) => void;
}

const PublicLangContext = createContext<PublicLangValue | undefined>(undefined);

export function PublicLangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState('en');

  useEffect(() => {
    const stored = localStorage.getItem(KEY);
    if (stored && PUBLIC_LANGUAGES.some((l) => l.code === stored)) {
      setLangState(stored);
    }
  }, []);

  const setLang = useCallback((code: string) => {
    setLangState(code);
    localStorage.setItem(KEY, code);
  }, []);

  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);
  return <PublicLangContext.Provider value={value}>{children}</PublicLangContext.Provider>;
}

export function usePublicLang() {
  const ctx = useContext(PublicLangContext);
  if (!ctx) return { lang: 'en', setLang: (_code: string) => undefined };
  return ctx;
}
