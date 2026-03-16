import en from "./en";
import es from "./es";
import fr from "./fr";

type Dictionary = typeof en;

const dictionaries: Record<string, Dictionary> = {
  en,
  es: es as unknown as Dictionary,
  fr: fr as unknown as Dictionary,
};

let currentLocale = "en";
const listeners = new Set<() => void>();

export const setLocale = (locale: string) => {
  const next = String(locale || "").trim();
  const resolved = dictionaries[next] ? next : "en";
  if (resolved === currentLocale) return;
  currentLocale = resolved;
  for (const l of listeners) l();
};

export const getLocale = () => currentLocale;

export const subscribeLocale = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getPath = (obj: any, path: string) => {
  const parts = String(path || "").split(".").filter(Boolean);
  let cur: any = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = cur[p];
  }
  return cur;
};

export const getString = (key: string): string => {
  const dict = dictionaries[currentLocale] || en;
  const val = getPath(dict, key);
  if (typeof val === "string") return val;

  const fallback = getPath(en, key);
  if (typeof fallback === "string") return fallback;

  return key;
};

export const t = (
  key: string,
  params?: Record<string, string | number | undefined | null>,
): string => {
  const raw = getString(key);
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (_m, k: string) => {
    const v = params[k];
    return v === undefined || v === null ? "" : String(v);
  });
};
