import { useNavigation, useRoute } from "@react-navigation/native";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ChapterReader } from "../../components/reader/ChapterReader";
import type { ReaderChapterItem } from "../../components/reader/ChapterDrawer";
import { Header } from "../../components/common/Header";
import { useHistory } from "../../context/HistoryContext";
import { useLibrary } from "../../context/LibraryContext";
import { useSettings } from "../../context/SettingsContext";
import { useTheme } from "../../context/ThemeContext";
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

  const { novelId, chapterId } = route.params as { novelId: string; chapterId: string };

  const novel = useMemo(() => novels.find((n) => n.id === novelId), [novels, novelId]);

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
      .map((c: any) => ({ name: String(c?.name || ""), path: String(c?.path || "") }))
      .filter((c) => c.path);
  }, [cached?.chapters, novel?.pluginCache?.chapters]);

  const initialChapter = useMemo(() => {
    if (chapters.length > 0) {
      const matched = chapters.find((c) => c.path === chapterId);
      if (matched) return { path: matched.path, title: matched.name };

      const numeric = Number(chapterId);
      if (Number.isFinite(numeric) && numeric > 0) {
        const idx = Math.min(
          chapters.length - 1,
          Math.max(0, Math.floor(numeric) - 1),
        );
        return { path: chapters[idx].path, title: chapters[idx].name };
      }
    }

    return { path: chapterId, title: undefined };
  }, [chapterId, chapters]);

  const initialChapters: ReaderChapterItem[] = useMemo(() => {
    if (chapters.length > 0) return chapters;
    return [{ name: initialChapter.title || "Chapter", path: initialChapter.path }];
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

      const instance = await PluginRuntimeService.loadLnReaderPlugin(plugin, {
        userAgent: settings.advanced.userAgent,
      });
      const parseChapter = (instance as any).parseChapter;
      if (typeof parseChapter !== "function") {
        throw new Error("This plugin does not support chapters.");
      }
      return (await parseChapter(path)) || "";
    },
    [plugin, pluginId, settings.advanced.userAgent],
  );

  const handleChapterRead = useCallback(
    (_chapter: ReaderChapterItem, index: number) => {
      if (!novel) return;
      const nextLastRead = Math.max(novel.lastReadChapter || 0, index + 1);
      const total =
        novel.totalChapters > 0 ? novel.totalChapters : Math.max(nextLastRead, chapters.length);
      const nextUnread = Math.max(0, total - nextLastRead);

      updateNovel(novel.id, {
        lastReadChapter: nextLastRead,
        unreadChapters: nextUnread,
        lastReadDate: new Date(),
      });

      const chapter: Chapter = {
        id: _chapter.path,
        novelId: novel.id,
        title: _chapter.name || "Chapter",
        number: index + 1,
        isRead: true,
        isDownloaded: false,
        releaseDate: new Date(),
      };
      const totalChaptersRead = Math.max(0, total - nextUnread);
      const progress = total > 0 ? (totalChaptersRead / total) * 100 : 0;
      const existing = historyEntries.find((e) => e.id === novel.id);

      upsertHistoryEntry({
        id: novel.id,
        novel: stripNovelForHistory({
          ...novel,
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
    [chapters.length, historyEntries, novel, updateNovel, upsertHistoryEntry],
  );

  const lastChapterRef = useRef<{ chapter: ReaderChapterItem; index: number } | null>(null);
  const sessionStartRef = useRef<number>(Date.now());
  const historyEntriesRef = useRef(historyEntries);
  const novelRef = useRef(novel);

  useEffect(() => {
    historyEntriesRef.current = historyEntries;
  }, [historyEntries]);

  useEffect(() => {
    novelRef.current = novel;
  }, [novel]);

  const handleChapterChange = useCallback(
    (chapter: ReaderChapterItem, index: number) => {
      lastChapterRef.current = { chapter, index };
      updateNovel(novelId, { lastReadDate: new Date() });

      if (!novel) return;
      const total = novel.totalChapters > 0 ? novel.totalChapters : chapters.length;
      const totalChaptersRead = Math.max(0, total - (novel.unreadChapters || 0));
      const progress = total > 0 ? (totalChaptersRead / total) * 100 : 0;
      const existing = historyEntries.find((e) => e.id === novel.id);

      const historyChapter: Chapter = {
        id: chapter.path,
        novelId: novel.id,
        title: chapter.name || "Chapter",
        number: index + 1,
        isRead: false,
        isDownloaded: false,
        releaseDate: new Date(),
      };

      upsertHistoryEntry({
        id: novel.id,
        novel: stripNovelForHistory({ ...novel, lastReadDate: new Date() }),
        lastReadChapter: historyChapter,
        progress,
        totalChaptersRead,
        lastReadDate: new Date(),
        timeSpentReading: existing?.timeSpentReading || 0,
      });
    },
    [chapters.length, historyEntries, novel, novelId, updateNovel, upsertHistoryEntry],
  );

  useEffect(() => {
    sessionStartRef.current = Date.now();
    return () => {
      const novelNow = novelRef.current;
      if (!novelNow) return;
      const last = lastChapterRef.current;
      if (!last) return;
      const elapsedMs = Date.now() - sessionStartRef.current;
      const minutes = Math.max(0, Math.round(elapsedMs / 60000));
      if (minutes <= 0) return;

      const existing = historyEntriesRef.current.find((e) => e.id === novelNow.id);
      const total = novelNow.totalChapters > 0 ? novelNow.totalChapters : chapters.length;
      const totalChaptersRead = Math.max(0, total - (novelNow.unreadChapters || 0));
      const progress = total > 0 ? (totalChaptersRead / total) * 100 : 0;
      const historyChapter: Chapter = {
        id: last.chapter.path,
        novelId: novelNow.id,
        title: last.chapter.name || "Chapter",
        number: last.index + 1,
        isRead: false,
        isDownloaded: false,
        releaseDate: new Date(),
      };

      upsertHistoryEntry({
        id: novelNow.id,
        novel: stripNovelForHistory({ ...novelNow }),
        lastReadChapter: historyChapter,
        progress,
        totalChaptersRead,
        lastReadDate: new Date(),
        timeSpentReading: (existing?.timeSpentReading || 0) + minutes,
      });
    };
  }, [chapters.length, novelId, upsertHistoryEntry]);

  const handleMarkRead = useCallback(() => {
    if (!novel) return;
    const total = novel.totalChapters > 0 ? novel.totalChapters : chapters.length;
    updateNovel(novel.id, {
      unreadChapters: 0,
      lastReadChapter: total,
      lastReadDate: new Date(),
    });
  }, [chapters.length, novel, updateNovel]);

  const handleMarkUnread = useCallback(() => {
    if (!novel) return;
    const total = novel.totalChapters > 0 ? novel.totalChapters : chapters.length;
    updateNovel(novel.id, {
      unreadChapters: total,
      lastReadChapter: 0,
      lastReadDate: undefined,
    });
  }, [chapters.length, novel, updateNovel]);

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
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Header title="Reader" onBackPress={() => (navigation as any).goBack()} />
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
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Header title="Reader" onBackPress={() => (navigation as any).goBack()} />
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
    />
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  message: { fontSize: 13, textAlign: "center" },
});
