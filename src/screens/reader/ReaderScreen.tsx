// src/screens/reader/ReaderScreen.tsx
import { useNavigation, useRoute } from "@react-navigation/native";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Header } from "../../components/common/Header";
import type { ReaderChapterItem } from "../../components/reader/ChapterDrawer";
import { ChapterReader } from "../../components/reader/ChapterReader";
import { useHistory } from "../../context/HistoryContext";
import { useLibrary } from "../../context/LibraryContext";
import { useSettings } from "../../context/SettingsContext";
import { useTheme } from "../../context/ThemeContext";
import { ChapterDownloads } from "../../services/chapterDownloads";
import { NovelDetailCache } from "../../services/novelDetailCache";
import { PluginRuntimeService } from "../../services/pluginRuntime";
import { getString } from "../../strings/translations";
import type { Chapter } from "../../types";

const isAbsoluteUrl = (url: string) => {
  if (!url) return false;
  if (url.startsWith("//")) return true;
  return /^https?:\/\//i.test(url);
};

const toAbsoluteHttpUrl = (input: string, base?: string) => {
  const raw = String(input || "").trim();
  if (!raw) return "";
  if (raw.startsWith("//")) return `https:${raw}`;
  if (/^https?:\/\//i.test(raw)) return raw;

  const baseRaw = String(base || "").trim();
  if (!baseRaw) return "";
  const baseNorm = baseRaw.startsWith("//") ? `https:${baseRaw}` : baseRaw;
  if (!/^https?:\/\//i.test(baseNorm)) return "";

  try {
    return new URL(raw, baseNorm).toString();
  } catch {
    return "";
  }
};

const stripNovelForHistory = (novel: any) => {
  if (!novel || typeof novel !== "object") return novel;
  const { pluginCache: _pluginCache, ...rest } = novel as any;
  return rest;
};

export const ReaderScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { theme } = useTheme();
  const { settings } = useSettings();
  const { novels, updateNovel } = useLibrary();
  const { historyEntries, upsertHistoryEntry } = useHistory();

  const { novelId, chapterId } = route.params as {
    novelId: string;
    chapterId: string;
  };

  const novel = useMemo(
    () => novels.find((n) => n.id === novelId),
    [novels, novelId],
  );

  // FIX: always-current ref so callbacks never capture stale novel state
  const novelRef = useRef(novel);
  useEffect(() => {
    novelRef.current = novel;
  }, [novel]);

  const pluginId = novel?.pluginId;
  const isLocalNovel = pluginId === "local";

  const installed = settings.extensions.installedPlugins || {};
  const plugin = pluginId ? installed[pluginId] : undefined;

  const cacheKey = useMemo(() => {
    if (!pluginId) return null;
    const path = novel?.pluginNovelPath;
    if (!path) return null;
    return NovelDetailCache.key(pluginId, path);
  }, [novel?.pluginNovelPath, pluginId]);

  const cached = useMemo(() => {
    if (!cacheKey) return undefined;
    return NovelDetailCache.get(cacheKey);
  }, [cacheKey]);

  const chapters: ReaderChapterItem[] = useMemo(() => {
    const fromDb = novel?.pluginCache?.chapters;
    const fromMem = cached?.chapters;
    const raw =
      Array.isArray(fromDb) && fromDb.length ? fromDb : (fromMem ?? []);
    return raw
      .map((c: any) => ({
        name: String(c?.name || ""),
        path: String(c?.path || ""),
      }))
      .filter((c) => c.path);
  }, [cached?.chapters, novel?.pluginCache?.chapters]);

  // Resume-reading support. We prioritise:
  // 1) Exact chapter path match
  // 2) "resume" sentinel or empty -> lastReadChapter index
  // 3) Fallback: treat chapterId as a raw path
  const initialChapter = useMemo(() => {
    if (chapters.length > 0) {
      // 1. Exact path match
      const matched = chapters.find((c) => c.path === chapterId);
      if (matched) return { path: matched.path, title: matched.name };

      // 2. "resume" sentinel or empty: open last-read chapter
      if (!chapterId || chapterId === "resume") {
        const lastIdx = Math.max(0, (novel?.lastReadChapter || 1) - 1);
        const idx = Math.min(chapters.length - 1, lastIdx);
        return { path: chapters[idx].path, title: chapters[idx].name };
      }
    }

    // 3. Fallback: treat chapterId as a raw path
    return { path: chapterId, title: undefined };
  }, [chapterId, chapters, novel?.lastReadChapter]);

  const historyEntry = useMemo(
    () => historyEntries.find((e) => e.id === novel?.id),
    [historyEntries, novel?.id],
  );

  const initialScrollProgress = useMemo(() => {
    const fromNovel = novel?.chapterScrollProgress?.[initialChapter.path];
    if (typeof fromNovel === "number" && Number.isFinite(fromNovel)) {
      return Math.max(0, Math.min(100, fromNovel));
    }

    const last = historyEntry?.lastReadChapter;
    if (!last) return undefined;
    if (last.id !== initialChapter.path) return undefined;
    const p = last.scrollProgress;
    if (typeof p !== "number" || !Number.isFinite(p)) return undefined;
    return Math.max(0, Math.min(100, p));
  }, [historyEntry?.lastReadChapter, initialChapter.path, novel?.chapterScrollProgress]);

  const initialChapters: ReaderChapterItem[] = useMemo(() => {
    if (chapters.length > 0) return chapters;
    return [
      { name: initialChapter.title || "Chapter", path: initialChapter.path },
    ];
  }, [chapters, initialChapter.path, initialChapter.title]);

  const baseUrl = useMemo(() => {
    if (isAbsoluteUrl(initialChapter.path)) return initialChapter.path;
    const site = plugin?.site || plugin?.url || "";
    return isAbsoluteUrl(site) ? site : undefined;
  }, [initialChapter.path, plugin?.site, plugin?.url]);

  const loadChapterHtml = useCallback(
    async (path: string) => {
      const n = novelRef.current;
      const pid = n?.pluginId;
      if (!pid) throw new Error("This novel has no source and cannot be read.");

      // Local/imported novels always read from stored HTML. Plugin novels prefer stored HTML if available.
      const shouldReadFromDisk = pid === "local" || Boolean(n?.chapterDownloaded?.[path]);
      if (shouldReadFromDisk) {
        const html = await ChapterDownloads.readChapterHtml(
          pid,
          novelId,
          path,
          settings.general.downloadLocation,
        );
        if (html != null) return html;
        if (pid === "local") {
          throw new Error("Local chapter file not found.");
        }
      }

      if (pid === "local") {
        throw new Error("Local chapter file not found.");
      }

      const installedPlugins = settings.extensions.installedPlugins || {};
      const sourcePlugin = installedPlugins[pid];
      if (!sourcePlugin) throw new Error("Plugin not installed.");
      if (!sourcePlugin.enabled) throw new Error("Plugin is disabled.");

      const instance = await PluginRuntimeService.loadLnReaderPlugin(sourcePlugin, {
        userAgent: settings.advanced.userAgent,
      });
      const parseChapter = (instance as any).parseChapter;
      if (typeof parseChapter !== "function") {
        throw new Error("This plugin does not support chapters.");
      }
      return (await parseChapter.call(instance, path)) || "";
    },
    [novelId, settings.advanced.userAgent, settings.extensions.installedPlugins, settings.general.downloadLocation],
  );

  const historyEntriesRef = useRef(historyEntries);
  useEffect(() => {
    historyEntriesRef.current = historyEntries;
  }, [historyEntries]);

  // FIX: onChapterRead — called when the user scrolls to the bottom of a chapter.
  // Uses novelRef so it always works with current data, not a stale closure snapshot.
  // Also writes chapterReadOverrides so the chapter list greys-out correctly.
  const handleChapterRead = useCallback(
    (_chapter: ReaderChapterItem, index: number) => {
      const n = novelRef.current;
      if (!n) return;

      const total =
        n.totalChapters > 0
          ? n.totalChapters
          : Math.max(index + 1, chapters.length);

      const nextLastRead = Math.max(n.lastReadChapter || 0, index + 1);
      const nextUnread = Math.max(0, total - nextLastRead);

      // Keep chapterReadOverrides in sync with what the user has actually read
      const updatedOverrides: Record<string, boolean> = {
        ...(n.chapterReadOverrides || {}),
        [_chapter.path]: true,
      };

      updateNovel(n.id, {
        lastReadChapter: nextLastRead,
        unreadChapters: nextUnread,
        lastReadDate: new Date(),
        chapterReadOverrides: updatedOverrides,
      });

      const chapter: Chapter = {
        id: _chapter.path,
        novelId: n.id,
        title: _chapter.name || "Chapter",
        number: index + 1,
        isRead: true,
        isDownloaded: false,
        releaseDate: new Date(),
        scrollProgress: 100,
      };
      lastScrollRef.current = { path: _chapter.path, progress: 100 };
      scrollProgressByPathRef.current[_chapter.path] = 100;
      const totalChaptersRead = Math.max(0, total - nextUnread);
      const progress = total > 0 ? (totalChaptersRead / total) * 100 : 0;
      const existing = historyEntriesRef.current.find((e) => e.id === n.id);

      upsertHistoryEntry({
        id: n.id,
        novel: stripNovelForHistory({
          ...n,
          lastReadChapter: nextLastRead,
          unreadChapters: nextUnread,
          lastReadDate: new Date(),
        }),
        lastReadChapter: chapter,
        progress,
        totalChaptersRead,
        lastReadDate: new Date(),
        timeSpentReading: existing?.timeSpentReading || 0,
      });
    },
    // chapters.length is stable enough as a dependency; novelRef is a ref so excluded

    [chapters.length, updateNovel, upsertHistoryEntry],
  );

  const lastChapterRef = useRef<{
    chapter: ReaderChapterItem;
    index: number;
  } | null>(null);
  const lastScrollRef = useRef<{ path: string; progress: number } | null>(null);
  const scrollProgressByPathRef = useRef<Record<string, number>>({});
  const sessionStartRef = useRef<number>(Date.now());

  // Ensure unmount persistence works even if the user never changes chapters.
  useEffect(() => {
    if (lastChapterRef.current) return;
    const idx = chapters.findIndex((c) => c.path === initialChapter.path);
    const chapter =
      idx >= 0
        ? chapters[idx]
        : { name: initialChapter.title || "Chapter", path: initialChapter.path };
    lastChapterRef.current = { chapter, index: idx >= 0 ? idx : 0 };
    lastScrollRef.current = {
      path: chapter.path,
      progress: initialScrollProgress ?? 0,
    };
  }, [
    chapters,
    initialChapter.path,
    initialChapter.title,
    initialScrollProgress,
  ]);

  // FIX: handleChapterChange also uses novelRef to avoid stale state
  const handleChapterChange = useCallback(
    (chapter: ReaderChapterItem, index: number) => {
      lastChapterRef.current = { chapter, index };
      lastScrollRef.current = { path: chapter.path, progress: 0 };
      updateNovel(novelId, { lastReadDate: new Date() });

      const n = novelRef.current;
      if (!n) return;
      const total = n.totalChapters > 0 ? n.totalChapters : chapters.length;
      const totalChaptersRead = Math.max(0, total - (n.unreadChapters || 0));
      const progress = total > 0 ? (totalChaptersRead / total) * 100 : 0;
      const existing = historyEntriesRef.current.find((e) => e.id === n.id);

      const historyChapter: Chapter = {
        id: chapter.path,
        novelId: n.id,
        title: chapter.name || "Chapter",
        number: index + 1,
        isRead: false,
        isDownloaded: false,
        releaseDate: new Date(),
        scrollProgress: 0,
      };

      upsertHistoryEntry({
        id: n.id,
        novel: stripNovelForHistory({ ...n, lastReadDate: new Date() }),
        lastReadChapter: historyChapter,
        progress,
        totalChaptersRead,
        lastReadDate: new Date(),
        timeSpentReading: existing?.timeSpentReading || 0,
      });
    },

    [chapters.length, novelId, updateNovel, upsertHistoryEntry],
  );

  const handleScrollProgress = useCallback(
    (chapter: ReaderChapterItem, index: number, progress: number) => {
      const p =
        typeof progress === "number" && Number.isFinite(progress)
          ? Math.max(0, Math.min(100, progress))
          : 0;
      lastChapterRef.current = { chapter, index };
      lastScrollRef.current = { path: chapter.path, progress: p };
      if (p > 0) scrollProgressByPathRef.current[chapter.path] = p;
    },
    [],
  );

  // Session time-tracking — runs on unmount
  useEffect(() => {
    sessionStartRef.current = Date.now();
    const sessionScrollProgress = scrollProgressByPathRef.current;
    return () => {
      const n = novelRef.current;
      if (!n) return;
      const last = lastChapterRef.current;
      if (!last) return;
      const elapsedMs = Date.now() - sessionStartRef.current;
      const minutes = Math.max(0, Math.round(elapsedMs / 60000));

      const existing = historyEntriesRef.current.find((e) => e.id === n.id);
      const prevTime = existing?.timeSpentReading || 0;
      const nextTime = minutes > 0 ? prevTime + minutes : prevTime;
      const total = n.totalChapters > 0 ? n.totalChapters : chapters.length;
      const totalChaptersRead = Math.max(0, total - (n.unreadChapters || 0));
      const progress = total > 0 ? (totalChaptersRead / total) * 100 : 0;

      const scrollRaw =
        lastScrollRef.current?.path === last.chapter.path
          ? lastScrollRef.current.progress
          : undefined;
      const scrollProgress =
        typeof scrollRaw === "number" && Number.isFinite(scrollRaw)
          ? Math.max(0, Math.min(100, scrollRaw))
          : undefined;
      if (typeof scrollProgress === "number" && scrollProgress > 0) {
        sessionScrollProgress[last.chapter.path] = scrollProgress;
      }

      const historyChapter: Chapter = {
        id: last.chapter.path,
        novelId: n.id,
        title: last.chapter.name || "Chapter",
        number: last.index + 1,
        isRead: false,
        isDownloaded: false,
        releaseDate: new Date(),
        scrollProgress,
      };

      upsertHistoryEntry({
        id: n.id,
        novel: stripNovelForHistory({ ...n }),
        lastReadChapter: historyChapter,
        progress,
        totalChaptersRead,
        lastReadDate: new Date(),
        timeSpentReading: nextTime,
      });

      const base = n.chapterScrollProgress || {};
      const session = sessionScrollProgress;
      let changed = false;
      const next: Record<string, number> = { ...base };
      for (const [path, value] of Object.entries(session)) {
        if (!path) continue;
        const p =
          typeof value === "number" && Number.isFinite(value)
            ? Math.max(0, Math.min(100, value))
            : null;
        if (p == null || p <= 0) continue;
        if (next[path] !== p) {
          next[path] = p;
          changed = true;
        }
      }
      if (changed) {
        const keys = Object.keys(next);
        updateNovel(n.id, {
          chapterScrollProgress: keys.length ? next : undefined,
        });
      }
    };
  }, [chapters.length, novelId, updateNovel, upsertHistoryEntry]);

  const handleMarkRead = useCallback(() => {
    const n = novelRef.current;
    if (!n) return;
    const total = n.totalChapters > 0 ? n.totalChapters : chapters.length;
    updateNovel(n.id, {
      unreadChapters: 0,
      lastReadChapter: total,
      lastReadDate: new Date(),
    });
  }, [chapters.length, updateNovel]);

  const handleMarkUnread = useCallback(() => {
    const n = novelRef.current;
    if (!n) return;
    const total = n.totalChapters > 0 ? n.totalChapters : chapters.length;
    updateNovel(n.id, {
      unreadChapters: total,
      lastReadChapter: 0,
      lastReadDate: undefined,
      chapterReadOverrides: undefined,
    });
  }, [chapters.length, updateNovel]);

  const extraMenuItems = useMemo(
    () => [
      { id: "markRead", label: "Mark as read", onPress: handleMarkRead },
      { id: "markUnread", label: "Mark as unread", onPress: handleMarkUnread },
    ],
    [handleMarkRead, handleMarkUnread],
  );

  const handleOpenWeb = useCallback(
    (path: string) => {
      const siteBase = toAbsoluteHttpUrl(String(plugin?.site || ""));
      const novelPath = String(novelRef.current?.pluginNovelPath || "");
      const novelUrl =
        toAbsoluteHttpUrl(novelPath) || toAbsoluteHttpUrl(novelPath, siteBase) || "";

      // Reader context: prefer opening the *current chapter* URL.
      const chapterUrl =
        toAbsoluteHttpUrl(path) ||
        toAbsoluteHttpUrl(path, novelUrl) ||
        toAbsoluteHttpUrl(path, siteBase) ||
        "";

      const url = chapterUrl || novelUrl || siteBase;
      if (!url) return;
      (navigation as any).navigate("WebView", { url });
    },
    [navigation, plugin?.site],
  );

  if (!novel) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <Header
          title={getString("screens.reader.title")}
          onBackPress={() => (navigation as any).goBack()}
        />
        <View style={styles.center}>
          <Text style={[styles.message, { color: theme.colors.error }]}>
            {getString("reader.errors.novelNotFound")}
          </Text>
        </View>
      </View>
    );
  }

  if (!pluginId) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <Header
          title={getString("screens.reader.title")}
          onBackPress={() => (navigation as any).goBack()}
        />
        <View style={styles.center}>
          <Text style={[styles.message, { color: theme.colors.textSecondary }]}>
            {getString("reader.errors.noSource")}
          </Text>
        </View>
      </View>
    );
  }

  const onOpenWeb = !isLocalNovel && plugin ? handleOpenWeb : undefined;

  return (
    <ChapterReader
      initialChapterPath={initialChapter.path}
      initialChapterTitle={initialChapter.title}
      initialScrollProgress={initialScrollProgress}
      chapters={initialChapters}
      loadChapterHtml={loadChapterHtml}
      baseUrl={baseUrl}
      onBack={() => (navigation as any).goBack()}
      onOpenWeb={onOpenWeb}
      onChapterChange={handleChapterChange}
      onChapterRead={handleChapterRead}
      onScrollProgress={handleScrollProgress}
      extraMenuItems={extraMenuItems}
      // FIX: pass reader behavior settings into ChapterReader
      swipeToNavigate={settings.reader.general.swipeToNavigate}
      tapToScroll={settings.reader.general.tapToScroll}
      keepScreenOn={settings.reader.general.keepScreenOn}
      showProgressPercentage={settings.reader.display.showProgressPercentage}
      readerTheme={settings.reader.theme}
    />
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  message: { fontSize: 13, textAlign: "center" },
});
