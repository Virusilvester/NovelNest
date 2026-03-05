import type { RouteProp } from "@react-navigation/native";
import { useNavigation, useRoute } from "@react-navigation/native";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { ChapterReader } from "../../components/reader/ChapterReader";
import type { ReaderChapterItem } from "../../components/reader/ChapterDrawer";
import { useHistory } from "../../context/HistoryContext";
import { useLibrary } from "../../context/LibraryContext";
import { useSettings } from "../../context/SettingsContext";
import type { RootStackParamList } from "../../navigation/types";
import { NovelDetailCache } from "../../services/novelDetailCache";
import { PluginRuntimeService } from "../../services/pluginRuntime";
import type { Chapter } from "../../types";

const isAbsoluteUrl = (url: string) => {
  if (!url) return false;
  if (url.startsWith("//")) return true;
  return /^https?:\/\//i.test(url);
};

export const PluginReaderScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, "PluginReader">>();
  const { settings } = useSettings();
  const { novels, updateNovel } = useLibrary();
  const { historyEntries, upsertHistoryEntry } = useHistory();

  const { pluginId, novelId, novelPath, chapterPath, chapterTitle } = route.params;

  const installed = settings.extensions.installedPlugins || {};
  const plugin = installed[pluginId];

  const libraryNovel = useMemo(() => {
    if (!novelId) return undefined;
    return novels.find((n) => n.id === novelId);
  }, [novelId, novels]);

  const effectiveNovelPath =
    novelPath ?? libraryNovel?.pluginNovelPath ?? undefined;

  const cacheKey = useMemo(() => {
    if (!effectiveNovelPath) return null;
    return NovelDetailCache.key(pluginId, effectiveNovelPath);
  }, [effectiveNovelPath, pluginId]);

  const cached = useMemo(() => {
    if (!cacheKey) return undefined;
    return NovelDetailCache.get(cacheKey);
  }, [cacheKey]);

  const chapters: ReaderChapterItem[] = useMemo(() => {
    const fromDb = libraryNovel?.pluginCache?.chapters;
    const fromMem = cached?.chapters;
    const raw =
      Array.isArray(fromDb) && fromDb.length ? fromDb : (fromMem ?? []);
    return raw
      .map((c: any) => ({
        name: String(c?.name || ""),
        path: String(c?.path || ""),
      }))
      .filter((c) => c.path);
  }, [cached?.chapters, libraryNovel?.pluginCache?.chapters]);

  const initialChapters: ReaderChapterItem[] = useMemo(() => {
    if (chapters.length > 0) return chapters;
    return [{ name: chapterTitle || "Chapter", path: chapterPath }];
  }, [chapterPath, chapterTitle, chapters]);

  const baseUrl = useMemo(() => {
    if (isAbsoluteUrl(chapterPath)) return chapterPath;
    const site = plugin?.site || plugin?.url || "";
    return isAbsoluteUrl(site) ? site : undefined;
  }, [chapterPath, plugin?.site, plugin?.url]);

  const loadChapterHtml = useCallback(
    async (path: string) => {
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
    [plugin, settings.advanced.userAgent],
  );

  const handleChapterRead = useCallback(
    (_chapter: ReaderChapterItem, index: number) => {
      const novel = libraryNovel;
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
        novel: { ...novel, pluginCache: undefined } as any,
        lastReadChapter: chapter,
        progress,
        totalChaptersRead,
        lastReadDate: new Date(),
        timeSpentReading: existing?.timeSpentReading || 0,
      });
    },
    [chapters.length, historyEntries, libraryNovel, updateNovel, upsertHistoryEntry],
  );

  const lastChapterRef = useRef<{ chapter: ReaderChapterItem; index: number } | null>(null);
  const sessionStartRef = useRef<number>(Date.now());
  const historyEntriesRef = useRef(historyEntries);
  const novelRef = useRef(libraryNovel);

  useEffect(() => {
    historyEntriesRef.current = historyEntries;
  }, [historyEntries]);

  useEffect(() => {
    novelRef.current = libraryNovel;
  }, [libraryNovel]);

  const handleChapterChange = useCallback(
    (chapter: ReaderChapterItem, index: number) => {
      lastChapterRef.current = { chapter, index };
      if (novelId) updateNovel(novelId, { lastReadDate: new Date() });

      const novel = libraryNovel;
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
        novel: { ...novel, pluginCache: undefined } as any,
        lastReadChapter: historyChapter,
        progress,
        totalChaptersRead,
        lastReadDate: new Date(),
        timeSpentReading: existing?.timeSpentReading || 0,
      });
    },
    [chapters.length, historyEntries, libraryNovel, novelId, updateNovel, upsertHistoryEntry],
  );

  useEffect(() => {
    sessionStartRef.current = Date.now();
    return () => {
      const novel = novelRef.current;
      if (!novel) return;
      const last = lastChapterRef.current;
      if (!last) return;
      const elapsedMs = Date.now() - sessionStartRef.current;
      const minutes = Math.max(0, Math.round(elapsedMs / 60000));
      if (minutes <= 0) return;

      const existing = historyEntriesRef.current.find((e) => e.id === novel.id);
      const total = novel.totalChapters > 0 ? novel.totalChapters : chapters.length;
      const totalChaptersRead = Math.max(0, total - (novel.unreadChapters || 0));
      const progress = total > 0 ? (totalChaptersRead / total) * 100 : 0;
      const historyChapter: Chapter = {
        id: last.chapter.path,
        novelId: novel.id,
        title: last.chapter.name || "Chapter",
        number: last.index + 1,
        isRead: false,
        isDownloaded: false,
        releaseDate: new Date(),
      };

      upsertHistoryEntry({
        id: novel.id,
        novel: { ...novel, pluginCache: undefined } as any,
        lastReadChapter: historyChapter,
        progress,
        totalChaptersRead,
        lastReadDate: new Date(),
        timeSpentReading: (existing?.timeSpentReading || 0) + minutes,
      });
    };
  }, [chapters.length, novelId, upsertHistoryEntry]);

  const extraMenuItems = useMemo(() => {
    if (!libraryNovel) return undefined;
    const total =
      libraryNovel.totalChapters > 0
        ? libraryNovel.totalChapters
        : chapters.length;
    return [
      {
        id: "markRead",
        label: "Mark as read",
        onPress: () =>
          updateNovel(libraryNovel.id, {
            unreadChapters: 0,
            lastReadChapter: total,
            lastReadDate: new Date(),
          }),
      },
      {
        id: "markUnread",
        label: "Mark as unread",
        onPress: () =>
          updateNovel(libraryNovel.id, {
            unreadChapters: total,
            lastReadChapter: 0,
            lastReadDate: undefined,
          }),
      },
    ];
  }, [chapters.length, libraryNovel, updateNovel]);

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

  return (
    <ChapterReader
      initialChapterPath={chapterPath}
      initialChapterTitle={chapterTitle}
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
