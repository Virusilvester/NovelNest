// src/services/pluginRuntime.ts
import { load as cheerioLoad } from "cheerio-without-node-native";
import dayjs from "dayjs";
import * as FileSystem from "expo-file-system/legacy";
import { Parser } from "htmlparser2";
import { Platform } from "react-native";
import type { InstalledExtensionPlugin } from "../types";

type RequireShim = (moduleName: string) => any;

const NOVELNEST_API_PREFIX = "novelnest-api|";

const isUrlAbsolute = (url: string) => {
  if (!url) return false;
  if (url.startsWith("//")) return true;
  if (!url.includes("://")) return false;
  return true;
};

const createRequireShim = (opts: { userAgent?: string }): RequireShim => {
  const storage = new Map<string, any>();

  const FilterTypes = {
    TextInput: "Text",
    Picker: "Picker",
    CheckboxGroup: "Checkbox",
    Switch: "Switch",
    ExcludableCheckboxGroup: "XCheckbox",
  } as const;

  const defaultCover =
    "https://github.com/lnreader/lnreader-plugins/blob/master/public/static/coverNotAvailable.webp?raw=true";

  const fetchApi = async (url: string, init?: RequestInit) => {
    const normalizedUrl =
      typeof url === "string" && url.startsWith("//") ? `https:${url}` : url;
    const headers: Record<string, string> = {
      Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
      ...(init?.headers as any),
    };

    // Browsers forbid setting User-Agent; doing so often results in a failed fetch.
    if (opts.userAgent && Platform.OS !== "web") {
      headers["User-Agent"] = opts.userAgent;
    }

    try {
      return await fetch(normalizedUrl, { ...init, headers });
    } catch (e: any) {
      const message =
        typeof e?.message === "string" && e.message.trim()
          ? e.message
          : String(e);
      throw new Error(`Network request failed (${normalizedUrl}): ${message}`);
    }
  };

  const libs = {
    "@libs/fetch": { fetchApi },
    "@libs/filterInputs": { FilterTypes },
    "@libs/defaultCover": {
      defaultCover: (cover?: string) =>
        cover && typeof cover === "string" && cover.trim()
          ? cover
          : defaultCover,
    },
    "@libs/novelStatus": {
      NovelStatus: {
        Ongoing: "ongoing",
        Completed: "completed",
      },
    },
    "@libs/storage": {
      storage: {
        get: (key: string) => storage.get(key),
        set: (key: string, value: any) => {
          storage.set(key, value);
        },
      },
    },
    "@libs/isAbsoluteUrl": { isUrlAbsolute },
  } as const;

  return (moduleName: string) => {
    if (moduleName === "cheerio") return { load: cheerioLoad };
    if (moduleName === "dayjs") return dayjs;
    if (moduleName === "htmlparser2") return { Parser };
    if (moduleName === "@/types/constants")
      return { defaultCover, FilterTypes };
    if (moduleName === "@/types/filterTypes") return { FilterTypes };
    if ((libs as any)[moduleName]) return (libs as any)[moduleName];
    throw new Error(`Unsupported plugin dependency: ${moduleName}`);
  };
};

const parseNovelNestApiMarker = (
  marker: string,
): { apiBase: string; sourceId: string } | null => {
  if (!marker.startsWith(NOVELNEST_API_PREFIX)) return null;
  const parts = marker.split("|");
  if (parts.length < 3) return null;
  const apiBase = parts[1];
  const sourceId = parts[2];
  if (!apiBase || !sourceId) return null;
  return { apiBase, sourceId };
};

const fetchWithTimeout = async (
  url: string,
  init: RequestInit | undefined,
  timeoutMs: number,
) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

const createNovelNestApiPlugin = (
  plugin: InstalledExtensionPlugin,
  opts: { userAgent?: string },
): LnReaderPlugin => {
  const parsed = parseNovelNestApiMarker(plugin.url);
  if (!parsed) {
    throw new Error("Invalid NovelNest API plugin marker.");
  }

  const { apiBase, sourceId } = parsed;

  const apiFetchJson = async (url: string) => {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (opts.userAgent && Platform.OS !== "web") {
      headers["User-Agent"] = opts.userAgent;
    }
    const res = await fetchWithTimeout(url, { headers }, 20_000);
    if (!res.ok) {
      throw new Error(`Request failed (${res.status})`);
    }
    return await res.json();
  };

  const apiFetchText = async (url: string) => {
    const headers: Record<string, string> = {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    };
    if (opts.userAgent && Platform.OS !== "web") {
      headers["User-Agent"] = opts.userAgent;
    }
    const res = await fetchWithTimeout(url, { headers }, 25_000);
    if (!res.ok) {
      throw new Error(`Request failed (${res.status})`);
    }
    return await res.text();
  };

  const mapBookToNovelItem = (b: any) => {
    const name = String(b?.title || b?.name || "");
    const path = String(b?.id || b?.path || "");
    const cover = b?.cover || b?.coverUrl || undefined;
    return { name, path, cover };
  };

  const fetchBooksPage = async (pageNo: number) => {
    const url = `${apiBase}/${encodeURIComponent(sourceId)}/books?page=${encodeURIComponent(
      String(pageNo),
    )}`;
    const data = await apiFetchJson(url);
    const raw = Array.isArray(data)
      ? data
      : Array.isArray(data?.data)
        ? data.data
        : [];
    const items = raw
      .map(mapBookToNovelItem)
      .filter((i: any) => i.name && i.path);
    (items as any).__hasMore = Boolean(data?.hasMore);
    (items as any).__page = Number(data?.currentPage ?? pageNo);
    return items;
  };

  const fetchAllChapters = async (bookId: string) => {
    const all: any[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= 50) {
      const url = `${apiBase}/${encodeURIComponent(sourceId)}/book/${encodeURIComponent(
        bookId,
      )}/chapters?page=${encodeURIComponent(String(page))}`;
      const res = await apiFetchJson(url);
      const items = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res)
          ? res
          : [];
      all.push(...items);
      hasMore = Boolean(res?.hasMore);
      page += 1;
      if (!hasMore) break;
      if (items.length === 0) break;
    }

    return all;
  };

  const fetchChaptersPage = async (bookId: string, pageNo: number) => {
    const url = `${apiBase}/${encodeURIComponent(sourceId)}/book/${encodeURIComponent(
      bookId,
    )}/chapters?page=${encodeURIComponent(String(pageNo))}`;
    const res = await apiFetchJson(url);
    const items = Array.isArray(res?.data)
      ? res.data
      : Array.isArray(res)
        ? res
        : [];
    return {
      chapters: items,
      hasMore: Boolean(res?.hasMore),
      page: Number(res?.currentPage ?? pageNo),
    };
  };

  const mapChapter = (c: any) => {
    const number = c?.number;
    const title = String(c?.title || "");
    const url = String(c?.url || c?.path || "");
    const name = title || (number != null ? `Chapter ${number}` : "Chapter");
    return {
      name,
      path: url,
      releaseTime: c?.updatedAt || c?.releaseTime || null,
      chapterNumber: typeof number === "number" ? number : undefined,
    };
  };

  const toAbsoluteUrl = (maybeUrl: string) => {
    if (!maybeUrl) return maybeUrl;
    if (isUrlAbsolute(maybeUrl)) return maybeUrl;
    const base = plugin.site?.replace(/\/+$/, "") || "";
    if (!base) return maybeUrl;
    if (maybeUrl.startsWith("/")) return `${base}${maybeUrl}`;
    return `${base}/${maybeUrl}`;
  };

  return {
    id: plugin.id,
    name: plugin.name,
    site: plugin.site,
    version: plugin.version,
    popularNovels: async (pageNo: number) => fetchBooksPage(pageNo),
    latestNovels: async (pageNo: number) => fetchBooksPage(pageNo),
    searchNovels: async (query: string, pageNo: number) => {
      const params = new URLSearchParams({
        q: query ?? "",
        source: sourceId,
        page: String(pageNo || 1),
      });
      const url = `${apiBase}/search?${params.toString()}`;
      const data = await apiFetchJson(url);
      const bucket =
        data && typeof data === "object"
          ? ((data as any)[sourceId] ??
            (Object.keys(data).length
              ? (data as any)[Object.keys(data)[0]]
              : undefined))
          : undefined;

      const raw = Array.isArray(bucket?.data)
        ? bucket.data
        : Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data)
            ? data
            : [];

      const items = raw
        .map(mapBookToNovelItem)
        .filter((i: any) => i.name && i.path);
      (items as any).__hasMore = Boolean(bucket?.hasMore ?? data?.hasMore);
      (items as any).__page = Number(
        bucket?.currentPage ?? data?.currentPage ?? pageNo,
      );
      return items;
    },
    parseNovel: async (bookId: string) => {
      const url = `${apiBase}/${encodeURIComponent(sourceId)}/book/${encodeURIComponent(
        bookId,
      )}`;
      const detail = await apiFetchJson(url);
      const chaptersRaw =
        Array.isArray(detail?.chapters) && detail.chapters.length
          ? detail.chapters
          : await fetchAllChapters(bookId);
      const chapters = chaptersRaw
        .map(mapChapter)
        .filter((c: any) => c.name && c.path);

      return {
        name: String(detail?.title || detail?.name || ""),
        path: String(detail?.id || bookId),
        cover: detail?.cover || detail?.coverUrl,
        author: detail?.author || "",
        status: detail?.status || "",
        summary: detail?.description || detail?.summary || "",
        genres: Array.isArray(detail?.genres) ? detail.genres : [],
        totalChapters:
          typeof detail?.totalChapters === "number"
            ? detail.totalChapters
            : undefined,
        chapters,
      };
    },
    fetchChaptersPage: async (novelPath: string, pageNo: number) => {
      const res = await fetchChaptersPage(novelPath, pageNo);
      const chapters = (res.chapters || [])
        .map(mapChapter)
        .filter((c: any) => c.name && c.path);
      return { chapters, hasMore: res.hasMore, page: res.page };
    },
    parseChapter: async (chapterPath: string) => {
      const url = toAbsoluteUrl(chapterPath);
      return await apiFetchText(url);
    },
  };
};

const cloneJsonValue = (value: any): any => {
  if (Array.isArray(value)) return value.map(cloneJsonValue);
  if (value && typeof value === "object") {
    const out: Record<string, any> = {};
    for (const k of Object.keys(value)) out[k] = cloneJsonValue(value[k]);
    return out;
  }
  return value;
};

const buildDefaultFilterValues = (filters: any) => {
  if (!filters || typeof filters !== "object") return undefined;
  const values: Record<string, any> = {};
  for (const key of Object.keys(filters)) {
    const f = (filters as any)[key];
    if (!f || typeof f !== "object") continue;
    if (!("type" in f) || !("value" in f)) continue;
    values[key] = { type: f.type, value: cloneJsonValue(f.value) };
  }
  return values;
};

const evalCommonJsModule = (code: string, requireShim: RequireShim): any => {
  const module = { exports: {} as any };
  const exports = module.exports;

  const fn = new Function("require", "module", "exports", code);
  fn(requireShim, module, exports);
  return module.exports;
};

export type LnReaderPlugin = {
  id?: string;
  name?: string;
  site?: string;
  version?: string;
  popularNovels?: (page: number) => Promise<any[]>;
  latestNovels?: (page: number) => Promise<any[]>;
  searchNovels?: (query: string, page: number) => Promise<any[]>;
  parseNovel?: (path: string) => Promise<any>;
  parseNovelAndChapters?: (path: string) => Promise<any>;
  parseChapter?: (path: string) => Promise<string>;
  fetchChaptersPage?: (
    novelPath: string,
    page: number,
  ) => Promise<{ chapters: any[]; hasMore?: boolean; page?: number }>;
};

const cache = new Map<string, Promise<LnReaderPlugin>>();

export const PluginRuntimeService = {
  loadLnReaderPlugin: async (
    plugin: InstalledExtensionPlugin,
    opts: { userAgent?: string },
  ): Promise<LnReaderPlugin> => {
    const key = `${plugin.id}:${plugin.localPath || plugin.url}:${plugin.version}`;
    const existing = cache.get(key);
    if (existing) return existing;

    const promise = (async () => {
      if (plugin.url.startsWith(NOVELNEST_API_PREFIX)) {
        return createNovelNestApiPlugin(plugin, opts);
      }

      let code: string;
      if (plugin.localPath) {
        code = await FileSystem.readAsStringAsync(plugin.localPath);
      } else {
        const response = await fetch(plugin.url);
        if (!response.ok) {
          throw new Error(`Failed to fetch plugin code (${response.status})`);
        }
        code = await response.text();
      }

      const requireShim = createRequireShim(opts);
      const mod = evalCommonJsModule(code, requireShim);
      const instance = (mod && (mod.default || mod)) as LnReaderPlugin;

      if (!instance || typeof instance !== "object") {
        throw new Error("Invalid plugin module export.");
      }

      // Patch common LNReader patterns: some compiled plugins destructure the options arg
      // (e.g. `popularNovels(pageNo, { showLatestNovels, filters })`) without a default.
      if (typeof instance.popularNovels === "function") {
        const original = instance.popularNovels;
        instance.popularNovels = ((pageNo: number, options?: any) => {
          const normalized = options ?? {};
          if (normalized.filters == null && (instance as any).filters) {
            normalized.filters = buildDefaultFilterValues(
              (instance as any).filters,
            );
          }
          return (original as any).call(instance, pageNo, normalized);
        }) as any;
      }
      if (typeof instance.latestNovels === "function") {
        const original = instance.latestNovels;
        instance.latestNovels = ((pageNo: number, options?: any) => {
          const normalized = options ?? {};
          if (normalized.filters == null && (instance as any).filters) {
            normalized.filters = buildDefaultFilterValues(
              (instance as any).filters,
            );
          }
          return (original as any).call(instance, pageNo, normalized);
        }) as any;
      }

      const bindMethod = (key: keyof LnReaderPlugin) => {
        const fn = (instance as any)[key];
        if (typeof fn !== "function") return;
        (instance as any)[key] = (...args: any[]) => fn.apply(instance, args);
      };

      // Some consumers (and some compiled plugins) pass methods around; binding prevents
      // `this`-related crashes like `this.getCheerio is not a function`.
      bindMethod("parseNovel");
      bindMethod("parseNovelAndChapters");
      bindMethod("parseChapter");
      bindMethod("searchNovels");
      bindMethod("fetchChaptersPage");

      return instance;
    })();

    cache.set(key, promise);
    return promise;
  },
};
