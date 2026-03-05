import type { RouteProp } from "@react-navigation/native";
import { useNavigation, useRoute } from "@react-navigation/native";
import React, { useCallback, useMemo } from "react";
import { ChapterReader } from "../../components/reader/ChapterReader";
import type { ReaderChapterItem } from "../../components/reader/ChapterDrawer";
import { useLibrary } from "../../context/LibraryContext";
import { useSettings } from "../../context/SettingsContext";
import type { RootStackParamList } from "../../navigation/types";
import { NovelDetailCache } from "../../services/novelDetailCache";
import { PluginRuntimeService } from "../../services/pluginRuntime";

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
    },
    [chapters.length, libraryNovel, updateNovel],
  );

  const handleChapterChange = useCallback(() => {
    if (!novelId) return;
    updateNovel(novelId, { lastReadDate: new Date() });
  }, [novelId, updateNovel]);

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
    />
  );
};
