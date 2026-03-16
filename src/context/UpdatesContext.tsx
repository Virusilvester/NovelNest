// src/context/UpdatesContext.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import {
  normalizePluginDetailForCache,
  NovelDetailCache,
} from "../services/novelDetailCache";
import { AndroidProgressNotifications } from "../services/androidProgressNotifications";
import { BackgroundTaskControls } from "../services/backgroundTaskControls";
import { PluginRuntimeService } from "../services/pluginRuntime";
import type { CachedPluginChapter, CachedPluginNovelDetail, Novel } from "../types";
import { detectChapterListOrder } from "../utils/chapterState";
import { useDownloadQueue } from "./DownloadQueueContext";
import { useLibrary } from "./LibraryContext";
import { useSettings } from "./SettingsContext";

export type UpdateEntry = {
  id: string;
  foundAt: number;
  pluginId: string;
  pluginName: string;
  novelId: string;
  novelTitle: string;
  novelCoverUrl?: string;
  chapterPath: string;
  chapterTitle: string;
  chapterNumber?: number;
  releaseTime?: string | null;
};

type UpdatesCheckResult = {
  checked: number;
  added: number;
  errors: number;
};

type UpdatesProgress = { current: number; total: number } | null;

type UpdatesContextType = {
  updates: UpdateEntry[];
  lastCheckedAt: number | null;
  isChecking: boolean;
  progress: UpdatesProgress;
  checkForUpdates: (opts?: { force?: boolean }) => Promise<UpdatesCheckResult>;
  clearUpdates: () => Promise<void>;
};

const UpdatesContext = createContext<UpdatesContextType | undefined>(undefined);

const STORAGE_KEY = "@novelnest_updates_v1";
const MAX_UPDATES = 500;
const MAX_NEW_PER_NOVEL = 50;

type PersistedUpdatesV1 = {
  version: 1;
  lastCheckedAt: number | null;
  entries: UpdateEntry[];
};

const isObject = (v: unknown): v is Record<string, any> =>
  Boolean(v) && typeof v === "object" && !Array.isArray(v);

const toSafeInt = (value: unknown): number | null => {
  if (typeof value !== "number") return null;
  if (!Number.isFinite(value)) return null;
  return Math.floor(value);
};

const clampInt = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Math.floor(Number.isFinite(value) ? value : 0)));

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number) => {
  let timeout: any;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("Timed out.")), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
};

const getUpdateIntervalMs = (frequency: string): number | null => {
  if (frequency === "12hours") return 12 * 60 * 60 * 1000;
  if (frequency === "daily") return 24 * 60 * 60 * 1000;
  return null;
};

const mapRawChapter = (c: any): CachedPluginChapter | null => {
  if (!c || typeof c !== "object") return null;
  const path = String((c as any).path || "");
  const name = String((c as any).name || "");
  if (!path) return null;
  if (!name) return null;
  const releaseTime =
    (c as any).releaseTime != null ? String((c as any).releaseTime) : null;
  const chapterNumber =
    typeof (c as any).chapterNumber === "number"
      ? (c as any).chapterNumber
      : typeof (c as any).number === "number"
        ? (c as any).number
        : undefined;
  return {
    path,
    name,
    releaseTime,
    chapterNumber:
      typeof chapterNumber === "number" && Number.isFinite(chapterNumber)
        ? chapterNumber
        : undefined,
  };
};

const dedupeChaptersByPath = (chapters: CachedPluginChapter[]) => {
  const seen = new Set<string>();
  const out: CachedPluginChapter[] = [];
  for (const c of chapters) {
    const path = String(c?.path || "");
    if (!path) continue;
    if (seen.has(path)) continue;
    seen.add(path);
    out.push(c);
  }
  return out;
};

const pickNewChapters = (
  remote: CachedPluginChapter[],
  knownPaths: Set<string>,
): CachedPluginChapter[] => {
  if (knownPaths.size === 0) return [];
  if (remote.length === 0) return [];

  const order = detectChapterListOrder(remote);
  const limit = Math.max(1, MAX_NEW_PER_NOVEL);
  const newChapters: CachedPluginChapter[] = [];

  if (order === "asc") {
    for (let i = remote.length - 1; i >= 0 && newChapters.length < limit; i--) {
      const c = remote[i];
      if (!c?.path) continue;
      if (knownPaths.has(c.path)) break;
      newChapters.push(c);
    }
    newChapters.reverse();
    return newChapters;
  }

  for (let i = 0; i < remote.length && newChapters.length < limit; i++) {
    const c = remote[i];
    if (!c?.path) continue;
    if (knownPaths.has(c.path)) break;
    newChapters.push(c);
  }
  return newChapters;
};

const statusFromDetail = (
  raw: unknown,
  fallback: Novel["status"],
): Novel["status"] => {
  const t = String(raw || "").toLowerCase();
  if (!t) return fallback;
  if (t.includes("complete") || t.includes("end") || t.includes("finished"))
    return "completed";
  if (t.includes("ongoing")) return "ongoing";
  return fallback;
};

export const UpdatesProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { settings, isReady: settingsReady } = useSettings();
  const { novels, updateNovel } = useLibrary();
  const { enqueue } = useDownloadQueue();

  const [hydrated, setHydrated] = useState(false);
  const [updates, setUpdates] = useState<UpdateEntry[]>([]);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [progress, setProgress] = useState<UpdatesProgress>(null);

  const isCheckingRef = useRef(false);
  const cancelCheckRef = useRef(false);
  const updatesRef = useRef(updates);
  useEffect(() => {
    updatesRef.current = updates;
  }, [updates]);

  const lastCheckedAtRef = useRef<number | null>(null);
  useEffect(() => {
    lastCheckedAtRef.current = lastCheckedAt;
  }, [lastCheckedAt]);

  const novelsRef = useRef(novels);
  useEffect(() => {
    novelsRef.current = novels;
  }, [novels]);

  const loadPersisted = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!isObject(parsed) || parsed.version !== 1) return;
      const v = parsed as PersistedUpdatesV1;
      const entries = Array.isArray(v.entries) ? v.entries : [];
      const cleaned = entries
        .filter((e) => isObject(e) && typeof e.id === "string")
        .map((e) => ({
          id: String((e as any).id),
          foundAt: toSafeInt((e as any).foundAt) ?? Date.now(),
          pluginId: String((e as any).pluginId || ""),
          pluginName: String((e as any).pluginName || ""),
          novelId: String((e as any).novelId || ""),
          novelTitle: String((e as any).novelTitle || ""),
          novelCoverUrl:
            (e as any).novelCoverUrl != null
              ? String((e as any).novelCoverUrl)
              : undefined,
          chapterPath: String((e as any).chapterPath || ""),
          chapterTitle: String((e as any).chapterTitle || ""),
          chapterNumber:
            typeof (e as any).chapterNumber === "number"
              ? (e as any).chapterNumber
              : undefined,
          releaseTime:
            (e as any).releaseTime != null
              ? String((e as any).releaseTime)
              : null,
        }))
        .filter((e) => e.pluginId && e.novelId && e.chapterPath)
        .slice(0, MAX_UPDATES);

      setUpdates(cleaned);
      setLastCheckedAt(toSafeInt(v.lastCheckedAt));
    } catch (e) {
      console.warn("Failed to load updates state:", e);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    void loadPersisted();
  }, [loadPersisted]);

  useEffect(() => {
    if (!isChecking) {
      AndroidProgressNotifications.clearTask("updates");
      return;
    }

    if (progress && progress.total > 0) {
      AndroidProgressNotifications.setTask("updates", {
        title: "Checking for updates",
        body: `Checking ${progress.current}/${progress.total}`,
        progress: {
          current: progress.current,
          max: progress.total,
          indeterminate: false,
        },
        actions: [
          {
            id: "updates_cancel",
            title: "Cancel",
          },
        ],
      });
      return;
    }

    AndroidProgressNotifications.setTask("updates", {
      title: "Checking for updates",
      body: "Starting…",
      progress: { indeterminate: true },
      actions: [
        {
          id: "updates_cancel",
          title: "Cancel",
        },
      ],
    });
  }, [isChecking, progress]);

  const cancelCheckForUpdates = useCallback(() => {
    if (!isCheckingRef.current) return;
    cancelCheckRef.current = true;
  }, []);

  useEffect(() => {
    BackgroundTaskControls.registerCancelUpdatesCheck(cancelCheckForUpdates);
    return () => {
      BackgroundTaskControls.registerCancelUpdatesCheck(null);
    };
  }, [cancelCheckForUpdates]);

  const persist = useCallback(async (next: PersistedUpdatesV1) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.warn("Failed to persist updates state:", e);
    }
  }, []);

  const clearUpdates = useCallback(async () => {
    setUpdates([]);
    await persist({
      version: 1,
      lastCheckedAt: lastCheckedAtRef.current,
      entries: [],
    });
  }, [persist]);

  const checkForUpdates = useCallback(
    async (_opts?: { force?: boolean }): Promise<UpdatesCheckResult> => {
      if (isCheckingRef.current) return { checked: 0, added: 0, errors: 0 };
      if (!settingsReady) return { checked: 0, added: 0, errors: 0 };

      const now = Date.now();

      isCheckingRef.current = true;
      cancelCheckRef.current = false;
      setIsChecking(true);

      try {
        const libraryNovels = novelsRef.current.filter((n) => n.isInLibrary);
        const onlyOngoing = Boolean(settings.updates.onlyUpdateOngoing);
        const toCheck = onlyOngoing
          ? libraryNovels.filter((n) => n.status === "ongoing")
          : libraryNovels;

        setProgress({ current: 0, total: toCheck.length });

        const installed = settings.extensions.installedPlugins || {};
        const userAgent = settings.advanced.userAgent;
        let checked = 0;
        let added = 0;
        let errors = 0;
        const found: UpdateEntry[] = [];

        const concurrency = 3;
        let nextIndex = 0;

        const workers = Array.from(
          { length: Math.min(concurrency, toCheck.length) },
          async () => {
            while (true) {
              if (cancelCheckRef.current) break;
              const index = nextIndex;
              nextIndex += 1;
              if (index >= toCheck.length) break;

              const novel = toCheck[index];
              const pluginId = novel.pluginId;
              const novelPath = novel.pluginNovelPath;
              try {
                if (!pluginId || !novelPath) continue;
                const plugin = installed[pluginId];
                if (!plugin || !plugin.enabled) continue;

                const instance = await withTimeout(
                  PluginRuntimeService.loadLnReaderPlugin(plugin, { userAgent }),
                  15_000,
                );
                const parseNovel =
                  (instance as any).parseNovelAndChapters ||
                  (instance as any).parseNovel;
                if (typeof parseNovel !== "function") continue;

                const data = await withTimeout(parseNovel(novelPath), 35_000);
                const detail = normalizePluginDetailForCache(data);
                const rawChapters = Array.isArray((data as any)?.chapters)
                  ? (data as any).chapters
                  : [];
                const mapped = rawChapters
                  .map(mapRawChapter)
                  .filter(Boolean) as CachedPluginChapter[];
                const remoteChapters = dedupeChaptersByPath(mapped);

                const known = Array.isArray(novel.pluginCache?.chapters)
                  ? novel.pluginCache!.chapters
                  : [];
                const knownPaths = new Set(
                  known
                    .map((c) => String(c?.path || ""))
                    .filter((p) => p.length > 0),
                );
                const newChapters = pickNewChapters(remoteChapters, knownPaths);

                const prevTotal = Math.max(
                  0,
                  toSafeInt(novel.totalChapters) ?? known.length,
                );

                const totalFromDetail =
                  typeof detail?.totalChapters === "number" &&
                  Number.isFinite(detail.totalChapters)
                    ? Math.max(0, Math.floor(detail.totalChapters))
                    : null;

                const nextTotalChapters = (() => {
                  if (totalFromDetail != null)
                    return Math.max(prevTotal, totalFromDetail);
                  if (remoteChapters.length > 0)
                    return Math.max(prevTotal, remoteChapters.length);
                  return prevTotal;
                })();

                const prevUnread = Math.max(0, toSafeInt(novel.unreadChapters) ?? 0);
                const prevRead = Math.max(0, prevTotal - prevUnread);
                const nextUnread = clampInt(
                  Math.max(0, nextTotalChapters - prevRead),
                  0,
                  Math.max(0, nextTotalChapters),
                );

                const mergedChapters =
                  remoteChapters.length > 0
                    ? dedupeChaptersByPath([...remoteChapters, ...known])
                    : known;

                const signature = NovelDetailCache.signature({
                  novelId: novel.id,
                  pluginId,
                  novelPath,
                  pluginVersion: plugin.version,
                  pluginUrl: plugin.url,
                  pluginLocalPath: plugin.localPath,
                  userAgent,
                });
                const canPage =
                  typeof (instance as any).fetchChaptersPage === "function";
                const cacheEntry: CachedPluginNovelDetail = {
                  signature,
                  cachedAt: now,
                  detail: detail ?? novel.pluginCache?.detail ?? null,
                  chapters: mergedChapters,
                  chaptersPage: 1,
                  chaptersHasMore:
                    canPage && totalFromDetail != null
                      ? mergedChapters.length < totalFromDetail
                      : false,
                };

                if (pluginId && novelPath) {
                  NovelDetailCache.set(
                    NovelDetailCache.key(pluginId, novelPath),
                    cacheEntry,
                  );
                }

                const pluginName = plugin.name || novel.source || pluginId;
                const nextStatus = statusFromDetail(detail?.status, novel.status);

                const updatesForNovel: Partial<Novel> = {
                  title: String(detail?.name || novel.title),
                  author: String(detail?.author || novel.author || "Unknown"),
                  coverUrl: String(detail?.cover || novel.coverUrl),
                  summary: String(detail?.summary || novel.summary || ""),
                  genres: Array.isArray(detail?.genres) ? detail.genres : novel.genres,
                  status: nextStatus,
                  totalChapters: nextTotalChapters,
                  pluginCache: cacheEntry,
                };

                const totalIncreased = nextTotalChapters > prevTotal;
                if (newChapters.length > 0 || totalIncreased) {
                  updatesForNovel.unreadChapters = nextUnread;
                }

                updateNovel(novel.id, updatesForNovel);

                if (newChapters.length > 0) {
                  for (const ch of newChapters) {
                    const entryId = `${pluginId}::${novel.id}::${ch.path}`;
                    found.push({
                      id: entryId,
                      foundAt: now,
                      pluginId,
                      pluginName,
                      novelId: novel.id,
                      novelTitle: String(detail?.name || novel.title),
                      novelCoverUrl: String(detail?.cover || novel.coverUrl || ""),
                      chapterPath: ch.path,
                      chapterTitle: ch.name,
                      chapterNumber: ch.chapterNumber,
                      releaseTime: ch.releaseTime ?? null,
                    });
                  }

                  added += newChapters.length;

                  const shouldAutoDownload =
                    Boolean(settings.autoDownload.downloadNewChapters) &&
                    novel.autoDownload !== false;

                  if (shouldAutoDownload) {
                    enqueue(
                      newChapters.map((c) => ({
                        pluginId,
                        pluginName,
                        novelId: novel.id,
                        novelTitle: String(detail?.name || novel.title),
                        chapterPath: c.path,
                        chapterTitle: c.name,
                      })),
                    );
                  }
                }
              } catch (e) {
                errors += 1;
                console.warn("Update check failed for novel:", novel?.id, e);
              } finally {
                checked += 1;
                setProgress((prev) =>
                  prev ? { ...prev, current: prev.current + 1 } : prev,
                );
              }
            }
          },
        );

        await Promise.all(workers);

        if (cancelCheckRef.current) {
          return { checked, added, errors };
        }

        const mergedUpdates = (() => {
          const prev = updatesRef.current;
          if (found.length === 0) return prev;
          const byId = new Map<string, UpdateEntry>();
          for (const e of prev) byId.set(e.id, e);
          for (const e of found) byId.set(e.id, e);
          const merged = Array.from(byId.values());
          merged.sort((a, b) => b.foundAt - a.foundAt);
          return merged.slice(0, MAX_UPDATES);
        })();

        if (found.length > 0) setUpdates(mergedUpdates);

        setLastCheckedAt(now);
        await persist({ version: 1, lastCheckedAt: now, entries: mergedUpdates });

        return { checked, added, errors };
      } finally {
        setIsChecking(false);
        setProgress(null);
        isCheckingRef.current = false;
      }
    },
    [enqueue, persist, settings, settingsReady, updateNovel],
  );

  useEffect(() => {
    if (!settingsReady) return;
    if (!hydrated) return;
    const interval = getUpdateIntervalMs(settings.updates.frequency);
    if (settings.updates.frequency === "manual") return;
    if (interval == null) return;

    const maybeRun = () => {
      if (isCheckingRef.current) return;
      const last = lastCheckedAtRef.current;
      const now = Date.now();
      const due = last == null ? true : now - last >= interval;
      if (!due) return;
      if (novelsRef.current.filter((n) => n.isInLibrary).length === 0) return;
      void checkForUpdates();
    };

    maybeRun();

    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      maybeRun();
    });

    return () => {
      sub.remove();
    };
  }, [
    checkForUpdates,
    hydrated,
    lastCheckedAt,
    novels.length,
    settings.updates.frequency,
    settingsReady,
  ]);

  const value = useMemo<UpdatesContextType>(
    () => ({
      updates,
      lastCheckedAt,
      isChecking,
      progress,
      checkForUpdates,
      clearUpdates,
    }),
    [checkForUpdates, clearUpdates, isChecking, lastCheckedAt, progress, updates],
  );

  return (
    <UpdatesContext.Provider value={value}>{children}</UpdatesContext.Provider>
  );
};

export const useUpdates = () => {
  const ctx = useContext(UpdatesContext);
  if (!ctx) throw new Error("useUpdates must be used within UpdatesProvider");
  return ctx;
};
