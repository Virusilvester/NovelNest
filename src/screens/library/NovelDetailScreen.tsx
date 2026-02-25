// src/screens/library/NovelDetailScreen.tsx
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Header } from "../../components/common/Header";
import { PopupMenu } from "../../components/common/PopupMenu";
import { useLibrary } from "../../context/LibraryContext";
import { useSettings } from "../../context/SettingsContext";
import { useTheme } from "../../context/ThemeContext";
import { PluginRuntimeService } from "../../services/pluginRuntime";
import { Novel } from "../../types";
import { clamp } from "../../utils/responsive";

type PluginChapterItem = {
  name: string;
  path: string;
  releaseTime?: string | null;
};

const isPluginChapterItem = (v: any): v is PluginChapterItem =>
  v &&
  typeof v === "object" &&
  typeof v.name === "string" &&
  typeof v.path === "string";

export const NovelDetailScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { theme } = useTheme();
  const { settings } = useSettings();
  const { novels, updateNovel } = useLibrary();
  const { width } = useWindowDimensions();

  const coverWidth = clamp(Math.round(Math.min(width * 0.28, 160)), 96, 160);
  const coverHeight = Math.round(coverWidth * 1.5);

  const { novelId } = route.params as { novelId: string };
  const novel = useMemo(() => novels.find((n) => n.id === novelId), [novels, novelId]);
  const linkedPlugin = useMemo(() => {
    if (!novel?.pluginId) return undefined;
    return settings.extensions.installedPlugins?.[novel.pluginId];
  }, [novel?.pluginId, settings.extensions.installedPlugins]);

  const [isDownloadMenuVisible, setIsDownloadMenuVisible] = useState(false);
  const [isMoreMenuVisible, setIsMoreMenuVisible] = useState(false);
  const [isInLibrary, setIsInLibrary] = useState(Boolean(novel?.isInLibrary));

  const [remoteDetail, setRemoteDetail] = useState<any>(null);
  const [remoteChapters, setRemoteChapters] = useState<PluginChapterItem[]>([]);
  const [isRemoteLoading, setIsRemoteLoading] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const lastFetchKeyRef = useRef<string | null>(null);

  useEffect(() => {
    setIsInLibrary(Boolean(novel?.isInLibrary));
  }, [novel?.isInLibrary]);

  useEffect(() => {
    const run = async () => {
      if (!novel?.pluginId || !novel?.pluginNovelPath) return;
      const plugin = linkedPlugin;
      if (!plugin) {
        setRemoteError("Source plugin is not installed.");
        return;
      }
      if (!plugin.enabled) {
        setRemoteError("Source plugin is disabled.");
        return;
      }

      const fetchKey = [
        novel.id,
        novel.pluginId,
        novel.pluginNovelPath,
        plugin.version,
        plugin.url,
        plugin.localPath || "",
        settings.advanced.userAgent,
      ].join("|");

      // Prevent infinite refresh loops: `updateNovel()` changes library state which re-renders this screen.
      // We only refetch when the novel/plugin reference or runtime inputs change.
      if (lastFetchKeyRef.current === fetchKey) return;
      lastFetchKeyRef.current = fetchKey;

      setRemoteError(null);
      setRemoteDetail(null);
      setRemoteChapters([]);

      try {
        setIsRemoteLoading(true);
        const instance = await PluginRuntimeService.loadLnReaderPlugin(plugin, {
          userAgent: settings.advanced.userAgent,
        });
        const parseNovel =
          (instance as any).parseNovelAndChapters || (instance as any).parseNovel;
        if (typeof parseNovel !== "function") {
          throw new Error("This source does not support novel details.");
        }

        const data = await parseNovel(novel.pluginNovelPath);
        setRemoteDetail(data);

        const chaptersRaw = Array.isArray(data?.chapters) ? data.chapters : [];
        const chaptersMapped = chaptersRaw
          .map((c: any) => ({
            name: String(c?.name || ""),
            path: String(c?.path || ""),
            releaseTime: c?.releaseTime ?? null,
          }))
          .filter(isPluginChapterItem);
        setRemoteChapters(chaptersMapped);

        updateNovel(novel.id, {
          title: String(data?.name || novel.title),
          author: String(data?.author || novel.author || "Unknown"),
          coverUrl: String(data?.cover || novel.coverUrl),
          summary: String(data?.summary || novel.summary || ""),
          genres: Array.isArray(data?.genres) ? data.genres : novel.genres,
          totalChapters: chaptersMapped.length || novel.totalChapters,
        });
      } catch (e: any) {
        setRemoteError(e?.message || "Failed to load novel details.");
      } finally {
        setIsRemoteLoading(false);
      }
    };

    run();
  }, [
    novel?.id,
    novel?.pluginId,
    novel?.pluginNovelPath,
    novel?.author,
    novel?.coverUrl,
    novel?.genres,
    novel?.summary,
    novel?.title,
    novel?.totalChapters,
    settings.advanced.userAgent,
    linkedPlugin,
    linkedPlugin?.enabled,
    linkedPlugin?.version,
    linkedPlugin?.url,
    linkedPlugin?.localPath,
    updateNovel,
  ]);

  const displayTitle = remoteDetail?.name || novel?.title || "Novel";
  const displayAuthor = remoteDetail?.author || novel?.author || "Unknown";
  const displayCover =
    remoteDetail?.cover || novel?.coverUrl || "https://via.placeholder.com/300x450";
  const displaySummary = remoteDetail?.summary || novel?.summary || "";
  const displayGenres: string[] = useMemo(() => {
    if (Array.isArray(remoteDetail?.genres)) return remoteDetail.genres;
    return novel?.genres || [];
  }, [remoteDetail?.genres, novel?.genres]);
  const displayStatus: Novel["status"] = useMemo(() => {
    const raw = String(remoteDetail?.status || novel?.status || "").toLowerCase();
    if (raw.includes("complete") || raw.includes("end") || raw.includes("finished"))
      return "completed";
    if (raw.includes("ongoing")) return "ongoing";
    return (novel?.status as any) || "ongoing";
  }, [remoteDetail?.status, novel?.status]);

  const chaptersTotal = remoteChapters.length || novel?.totalChapters || 0;
  const chaptersRead = Math.max(
    0,
    (novel?.totalChapters || chaptersTotal) - (novel?.unreadChapters || 0),
  );
  const progressPercent =
    (novel?.totalChapters || chaptersTotal) > 0
      ? (chaptersRead / (novel?.totalChapters || chaptersTotal)) * 100
      : 0;

  const downloadOptions = [
    { id: "next", label: "Next chapter", onPress: () => {} },
    { id: "next5", label: "Next 5 chapters", onPress: () => {} },
    { id: "next10", label: "Next 10 chapters", onPress: () => {} },
    { id: "custom", label: "Custom", onPress: () => {} },
    { id: "unread", label: "Unread", onPress: () => {} },
    { id: "all", label: "All", onPress: () => {} },
    {
      id: "delete",
      label: "Delete downloads",
      isDestructive: true,
      onPress: () => {},
    },
  ];

  const moreOptions = [
    { id: "editInfo", label: "Edit info", onPress: () => {} },
    { id: "editCover", label: "Edit cover", onPress: () => {} },
  ];

  const handleShare = () => {};
  const handleEpubExport = () => {};

  const handleWebView = () => {
    const url =
      remoteDetail?.url ||
      (novel?.pluginId
        ? settings.extensions.installedPlugins?.[novel.pluginId]?.site
        : null) ||
      `https://example.com/novel/${novel?.id || ""}`;
    (navigation as any).navigate("WebView", { url });
  };

  const handleLibraryToggle = () => {
    if (!novel) return;
    const next = !isInLibrary;
    setIsInLibrary(next);
    updateNovel(novel.id, { isInLibrary: next });
  };

  const handleGenrePress = (genre: string) => {
    (navigation as any).navigate("SourceDetail", { genre });
  };

  const handlePluginChapterPress = (c: PluginChapterItem) => {
    if (!novel?.pluginId) return;
    (navigation as any).navigate("PluginReader", {
      pluginId: novel.pluginId,
      chapterPath: c.path,
      chapterTitle: c.name,
    });
  };

  const handleProgressPress = () => {
    if (novel?.pluginId && remoteChapters.length > 0) {
      handlePluginChapterPress(remoteChapters[0]);
      return;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Header
        title=""
        onBackPress={() => (navigation as any).goBack()}
        rightButtons={
          <>
            <TouchableOpacity onPress={handleEpubExport} style={styles.iconButton}>
              <Ionicons name="document-text" size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleShare} style={styles.iconButton}>
              <Ionicons name="share-outline" size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setIsDownloadMenuVisible(true)}
              style={styles.iconButton}
            >
              <Ionicons
                name={novel?.isDownloaded ? "download" : "download-outline"}
                size={24}
                color={novel?.isDownloaded ? theme.colors.success : theme.colors.text}
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setIsMoreMenuVisible(true)} style={styles.iconButton}>
              <Ionicons name="ellipsis-vertical" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </>
        }
      />

      {!novel ? (
        <View style={styles.loadingCenter}>
          <Text style={[styles.errorText, { color: theme.colors.error }]}>
            Novel not found in library.
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.content}>
          {remoteError ? (
            <View style={styles.section}>
              <Text style={[styles.summary, { color: theme.colors.error }]}>
                {remoteError}
              </Text>
            </View>
          ) : null}

          {isRemoteLoading ? (
            <View style={styles.loadingCenter}>
              <ActivityIndicator />
              <Text style={[styles.centerText, { color: theme.colors.textSecondary }]}>
                Loading details...
              </Text>
            </View>
          ) : null}

          <View style={styles.headerSection}>
            <Image
              source={{ uri: displayCover }}
              style={[styles.cover, { width: coverWidth, height: coverHeight }]}
            />
            <View style={styles.headerInfo}>
              <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={3}>
                {displayTitle}
              </Text>
              <Text style={[styles.author, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                {displayAuthor}
              </Text>
              <View style={styles.statusRow}>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        displayStatus === "completed" ? theme.colors.success : theme.colors.warning,
                    },
                  ]}
                >
                  <Text style={styles.statusText}>{displayStatus}</Text>
                </View>
                <Text style={[styles.source, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                  {novel.source}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
              onPress={handleLibraryToggle}
            >
              <Text style={styles.actionButtonText}>
                {isInLibrary ? "In library" : "Add to library"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.actionButton,
                {
                  backgroundColor: theme.colors.surface,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                },
              ]}
              onPress={handleWebView}
            >
              <Text style={[styles.actionButtonText, { color: theme.colors.text }]}>WebView</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Summary</Text>
            <Text style={[styles.summary, { color: theme.colors.textSecondary }]}>
              {displaySummary || "(No summary)"}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Genres</Text>
            <View style={styles.genresContainer}>
              {displayGenres.map((genre) => (
                <TouchableOpacity
                  key={genre}
                  style={[
                    styles.genreTag,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.border,
                    },
                  ]}
                  onPress={() => handleGenrePress(genre)}
                >
                  <Text style={[styles.genreText, { color: theme.colors.primary }]}>{genre}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity style={styles.progressSection} onPress={handleProgressPress}>
            <View style={styles.progressInfo}>
              <Text style={[styles.progressText, { color: theme.colors.text }]}>Progress</Text>
              <Text style={[styles.progressText, { color: theme.colors.primary }]}>
                {chaptersRead} / {novel.totalChapters || chaptersTotal}
              </Text>
            </View>
            <View style={[styles.progressBar, { backgroundColor: theme.colors.border }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: theme.colors.primary,
                    width: `${progressPercent}%`,
                  },
                ]}
              />
            </View>
            <Text style={[styles.chapterCount, { color: theme.colors.textSecondary }]}>
              {chaptersTotal} chapters
            </Text>
          </TouchableOpacity>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Chapters</Text>
            {novel.pluginId && remoteChapters.length > 0
              ? remoteChapters.map((c) => (
                  <TouchableOpacity
                    key={c.path}
                    style={[
                      styles.chapterItem,
                      { borderBottomColor: theme.colors.divider },
                    ]}
                    onPress={() => handlePluginChapterPress(c)}
                  >
                    <Text style={[styles.chapterTitle, { color: theme.colors.text }]} numberOfLines={2}>
                      {c.name}
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color={theme.colors.textSecondary}
                    />
                  </TouchableOpacity>
                ))
              : (
                <Text style={[styles.summary, { color: theme.colors.textSecondary }]}>
                  Chapters are not available for this item yet.
                </Text>
              )}
          </View>
        </ScrollView>
      )}

      <PopupMenu
        visible={isDownloadMenuVisible}
        onClose={() => setIsDownloadMenuVisible(false)}
        items={downloadOptions}
      />

      <PopupMenu
        visible={isMoreMenuVisible}
        onClose={() => setIsMoreMenuVisible(false)}
        items={moreOptions}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  iconButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  loadingCenter: {
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  centerText: {
    fontSize: 12,
  },
  errorText: {
    fontSize: 13,
    textAlign: "center",
  },
  headerSection: {
    flexDirection: "row",
    padding: 16,
  },
  cover: {
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
  },
  headerInfo: {
    flex: 1,
    marginLeft: 16,
    justifyContent: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
  },
  author: {
    fontSize: 14,
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  source: {
    fontSize: 12,
  },
  actionButtons: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  actionButtonText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "bold",
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 8,
  },
  summary: {
    fontSize: 14,
    lineHeight: 20,
  },
  genresContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  genreTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  genreText: {
    fontSize: 12,
  },
  progressSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  progressInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  progressText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  chapterCount: {
    fontSize: 12,
  },
  chapterItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  chapterTitle: {
    fontSize: 14,
    flex: 1,
  },
});
