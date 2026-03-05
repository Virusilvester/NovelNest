import type { CachedPluginNovelDetail } from "../types";

export const normalizePluginDetailForCache = (
  raw: any,
): CachedPluginNovelDetail["detail"] => {
  if (!raw || typeof raw !== "object") return null;
  const detail = raw as any;
  const genres = Array.isArray(detail.genres)
    ? detail.genres.map((g: any) => String(g)).filter(Boolean)
    : undefined;
  const totalChapters =
    typeof detail.totalChapters === "number" && Number.isFinite(detail.totalChapters)
      ? detail.totalChapters
      : undefined;

  return {
    name: detail.name != null ? String(detail.name) : undefined,
    author: detail.author != null ? String(detail.author) : undefined,
    cover: detail.cover != null ? String(detail.cover) : undefined,
    summary: detail.summary != null ? String(detail.summary) : undefined,
    genres: genres?.length ? genres : undefined,
    status: detail.status != null ? String(detail.status) : undefined,
    totalChapters,
    url: detail.url != null ? String(detail.url) : undefined,
    path: detail.path != null ? String(detail.path) : undefined,
  };
};

const MAX_ENTRIES = 25;
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

const cache = new Map<string, CachedPluginNovelDetail>();

const now = () => Date.now();

const evictIfNeeded = () => {
  while (cache.size > MAX_ENTRIES) {
    const firstKey = cache.keys().next().value as string | undefined;
    if (!firstKey) return;
    cache.delete(firstKey);
  }
};

const isExpired = (entry: CachedPluginNovelDetail) =>
  now() - entry.cachedAt > CACHE_TTL_MS;

export const NovelDetailCache = {
  key(pluginId: string, novelPath: string) {
    return `${pluginId}::${novelPath}`;
  },

  signature(input: {
    novelId?: string;
    pluginId: string;
    novelPath: string;
    pluginVersion?: string;
    pluginUrl?: string;
    pluginLocalPath?: string;
    userAgent?: string;
  }) {
    return [
      input.novelId ?? "",
      input.pluginId,
      input.novelPath,
      input.pluginVersion ?? "",
      input.pluginUrl ?? "",
      input.pluginLocalPath ?? "",
      input.userAgent ?? "",
    ].join("|");
  },

  get(key: string): CachedPluginNovelDetail | undefined {
    const entry = cache.get(key);
    if (!entry) return undefined;
    if (isExpired(entry)) {
      cache.delete(key);
      return undefined;
    }
    // Bump for LRU-ish behavior.
    cache.delete(key);
    cache.set(key, entry);
    return entry;
  },

  set(key: string, entry: CachedPluginNovelDetail) {
    cache.set(key, entry);
    evictIfNeeded();
  },

  clear(key: string) {
    cache.delete(key);
  },
};
