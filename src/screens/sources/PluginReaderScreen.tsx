// src/screens/library/PluginReaderScreen.tsx
import type { RouteProp } from "@react-navigation/native";
import { useNavigation, useRoute } from "@react-navigation/native";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import type { ReaderChapterItem } from "../../components/reader/ChapterDrawer";
import { ChapterReader } from "../../components/reader/ChapterReader";
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

  const { pluginId, novelId, novelPath, chapterPath, chapterTitle } =
    route.params;

  const installed = settings.extensions.installedPlugins || {};
  const plugin = installed[pluginId];

  const libraryNovel = useMemo(() => {
    if (!novelId) return undefined;
    return novels.find((n) => n.id === novelId);
  }, [novelId, novels]);

  // FIX: always-current ref so callbacks never capture stale novel state
  const libraryNovelRef = useRef(libraryNovel);
  useEffect(() => {
    libraryNovelRef.current = libraryNovel;
  }, [libraryNovel]);

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
      return (await parseChapter.call(instance, path)) || "";
    },
    [plugin, settings.advanced.userAgent],
  );

  const historyEntriesRef = useRef(historyEntries);
  useEffect(() => {
    historyEntriesRef.current = historyEntries;
  }, [historyEntries]);

  // FIX: uses novelRef to avoid stale closure, writes chapterReadOverrides for chapter list sync
  const handleChapterRead = useCallback(
    (_chapter: ReaderChapterItem, index: number) => {
      const n = libraryNovelRef.current;
      if (!n) return;

      const total =
        n.totalChapters > 0
          ? n.totalChapters
          : Math.max(index + 1, chapters.length);
      const nextLastRead = Math.max(n.lastReadChapter || 0, index + 1);
      const nextUnread = Math.max(0, total - nextLastRead);

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
        novel: { ...n, pluginCache: undefined } as any,
        lastReadChapter: chapter,
        progress,
        totalChaptersRead,
        lastReadDate: new Date(),
        timeSpentReading: existing?.timeSpentReading || 0,
      });
    },

    [chapters.length, updateNovel, upsertHistoryEntry],
  );

  const lastChapterRef = useRef<{
    chapter: ReaderChapterItem;
    index: number;
  } | null>(null);
  const sessionStartRef = useRef<number>(Date.now());

  // FIX: uses novelRef to avoid stale state
  const handleChapterChange = useCallback(
    (chapter: ReaderChapterItem, index: number) => {
      lastChapterRef.current = { chapter, index };
      if (novelId) updateNovel(novelId, { lastReadDate: new Date() });

      const n = libraryNovelRef.current;
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
        novel: { ...n, pluginCache: undefined } as any,
        lastReadChapter: historyChapter,
        progress,
        totalChaptersRead,
        lastReadDate: new Date(),
        timeSpentReading: existing?.timeSpentReading || 0,
      });
    },

    [chapters.length, novelId, updateNovel, upsertHistoryEntry],
  );

  useEffect(() => {
    sessionStartRef.current = Date.now();
    return () => {
      const n = libraryNovelRef.current;
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
        novel: { ...n, pluginCache: undefined } as any,
        lastReadChapter: historyChapter,
        progress,
        totalChaptersRead,
        lastReadDate: new Date(),
        timeSpentReading: (existing?.timeSpentReading || 0) + minutes,
      });
    };
  }, [chapters.length, novelId, upsertHistoryEntry]);

  const extraMenuItems = useMemo(() => {
    const n = libraryNovel;
    if (!n) return undefined;
    const total = n.totalChapters > 0 ? n.totalChapters : chapters.length;
    return [
      {
        id: "markRead",
        label: "Mark as read",
        onPress: () =>
          updateNovel(n.id, {
            unreadChapters: 0,
            lastReadChapter: total,
            lastReadDate: new Date(),
          }),
      },
      {
        id: "markUnread",
        label: "Mark as unread",
        onPress: () =>
          updateNovel(n.id, {
            unreadChapters: total,
            lastReadChapter: 0,
            lastReadDate: undefined,
            chapterReadOverrides: undefined,
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
      // FIX: pass reader behavior settings into ChapterReader
      swipeToNavigate={settings.reader.general.swipeToNavigate}
      tapToScroll={settings.reader.general.tapToScroll}
      keepScreenOn={settings.reader.general.keepScreenOn}
      showProgressPercentage={settings.reader.display.showProgressPercentage}
      readerTheme={settings.reader.theme}
    />
  );
};
