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
import type { Chapter } from "../../types";

const isAbsoluteUrl = (url: string) => {
  if (!url) return false;
  if (url.startsWith("//")) return true;
  return /^https?:\/\//i.test(url);
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
  const novelPath = novel?.pluginNovelPath;

  const installed = settings.extensions.installedPlugins || {};
  const plugin = pluginId ? installed[pluginId] : undefined;

  const cacheKey = useMemo(() => {
    if (!pluginId || !novelPath) return null;
    return NovelDetailCache.key(pluginId, novelPath);
  }, [novelPath, pluginId]);

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
      if (!pluginId) throw new Error("Novel does not have a source plugin.");
      if (!plugin) throw new Error("Plugin not installed.");
      if (!plugin.enabled) throw new Error("Plugin is disabled.");

      if (novel?.chapterDownloaded?.[path]) {
        const html = await ChapterDownloads.readChapterHtml(
          pluginId,
          novelId,
          path,
          settings.general.downloadLocation,
        );
        if (html != null) return html;
      }

      const instance = await PluginRuntimeService.loadLnReaderPlugin(plugin, {
        userAgent: settings.advanced.userAgent,
      });
      const parseChapter = (instance as any).parseChapter;
      if (typeof parseChapter !== "function") {
        throw new Error("This plugin does not support chapters.");
      }
      return (await parseChapter.call(instance, path)) || "";
    },
    [
      novel?.chapterDownloaded,
      novelId,
      plugin,
      pluginId,
      settings.advanced.userAgent,
      settings.general.downloadLocation,
    ],
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
      };
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
  const sessionStartRef = useRef<number>(Date.now());

  // FIX: handleChapterChange also uses novelRef to avoid stale state
  const handleChapterChange = useCallback(
    (chapter: ReaderChapterItem, index: number) => {
      lastChapterRef.current = { chapter, index };
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

  // Session time-tracking — runs on unmount
  useEffect(() => {
    sessionStartRef.current = Date.now();
    return () => {
      const n = novelRef.current;
      if (!n) return;
      const last = lastChapterRef.current;
      if (!last) return;
      const elapsedMs = Date.now() - sessionStartRef.current;
      const minutes = Math.max(0, Math.round(elapsedMs / 60000));
      if (minutes <= 0) return;

      const existing = historyEntriesRef.current.find((e) => e.id === n.id);
      const total = n.totalChapters > 0 ? n.totalChapters : chapters.length;
      const totalChaptersRead = Math.max(0, total - (n.unreadChapters || 0));
      const progress = total > 0 ? (totalChaptersRead / total) * 100 : 0;

      const historyChapter: Chapter = {
        id: last.chapter.path,
        novelId: n.id,
        title: last.chapter.name || "Chapter",
        number: last.index + 1,
        isRead: false,
        isDownloaded: false,
        releaseDate: new Date(),
      };

      upsertHistoryEntry({
        id: n.id,
        novel: stripNovelForHistory({ ...n }),
        lastReadChapter: historyChapter,
        progress,
        totalChaptersRead,
        lastReadDate: new Date(),
        timeSpentReading: (existing?.timeSpentReading || 0) + minutes,
      });
    };
  }, [chapters.length, novelId, upsertHistoryEntry]);

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
      const url =
        (isAbsoluteUrl(path) && path) ||
        (isAbsoluteUrl(plugin?.site || "") && (plugin?.site as string)) ||
        (isAbsoluteUrl(plugin?.url || "") && (plugin?.url as string)) ||
        "";
      if (!url) return;
      (navigation as any).navigate("WebView", { url });
    },
    [navigation, plugin?.site, plugin?.url],
  );

  if (!novel) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <Header
          title="Reader"
          onBackPress={() => (navigation as any).goBack()}
        />
        <View style={styles.center}>
          <Text style={[styles.message, { color: theme.colors.error }]}>
            Novel not found.
          </Text>
        </View>
      </View>
    );
  }

  if (!pluginId || !novelPath) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <Header
          title="Reader"
          onBackPress={() => (navigation as any).goBack()}
        />
        <View style={styles.center}>
          <Text style={[styles.message, { color: theme.colors.textSecondary }]}>
            This reader currently supports plugin novels only.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ChapterReader
      initialChapterPath={initialChapter.path}
      initialChapterTitle={initialChapter.title}
      chapters={initialChapters}
      loadChapterHtml={loadChapterHtml}
      baseUrl={baseUrl}
      onBack={() => (navigation as any).goBack()}
      onOpenWeb={handleOpenWeb}
      onChapterChange={handleChapterChange}
      onChapterRead={handleChapterRead}
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
