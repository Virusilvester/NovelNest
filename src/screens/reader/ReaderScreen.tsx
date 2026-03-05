import { useNavigation, useRoute } from "@react-navigation/native";
import React, { useCallback, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ChapterReader } from "../../components/reader/ChapterReader";
import type { ReaderChapterItem } from "../../components/reader/ChapterDrawer";
import { Header } from "../../components/common/Header";
import { useLibrary } from "../../context/LibraryContext";
import { useSettings } from "../../context/SettingsContext";
import { useTheme } from "../../context/ThemeContext";
import { NovelDetailCache } from "../../services/novelDetailCache";
import { PluginRuntimeService } from "../../services/pluginRuntime";

const isAbsoluteUrl = (url: string) => {
  if (!url) return false;
  if (url.startsWith("//")) return true;
  return /^https?:\/\//i.test(url);
};

export const ReaderScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { theme } = useTheme();
  const { settings } = useSettings();
  const { novels, updateNovel } = useLibrary();

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
    const numeric = Number(chapterId);
    if (Number.isFinite(numeric) && numeric > 0 && chapters.length > 0) {
      const idx = Math.min(chapters.length - 1, Math.max(0, Math.floor(numeric) - 1));
      return { path: chapters[idx].path, title: chapters[idx].name };
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
    },
    [chapters.length, novel, updateNovel],
  );

  const handleChapterChange = useCallback(() => {
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
    />
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  message: { fontSize: 13, textAlign: "center" },
});
