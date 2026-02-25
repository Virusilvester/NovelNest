import { Ionicons } from "@expo/vector-icons";
import type { RouteProp } from "@react-navigation/native";
import { useNavigation, useRoute } from "@react-navigation/native";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
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
import type { RootStackParamList } from "../../navigation/types";
import { PluginRuntimeService } from "../../services/pluginRuntime";
import type { Novel } from "../../types";
import { clamp } from "../../utils/responsive";

type ChapterItem = {
  name: string;
  path: string;
  releaseTime?: string | null;
  chapterNumber?: number;
};

const isChapterItem = (value: any): value is ChapterItem =>
  value &&
  typeof value === "object" &&
  typeof value.name === "string" &&
  typeof value.path === "string";

export const PluginNovelDetailScreen: React.FC = () => {
  const navigation = useNavigation();
  const route =
    useRoute<RouteProp<RootStackParamList, "PluginNovelDetail">>();
  const { theme } = useTheme();
  const { settings } = useSettings();
  const { novels, addNovel, updateNovel } = useLibrary();
  const { width } = useWindowDimensions();

  const coverWidth = clamp(Math.round(Math.min(width * 0.28, 160)), 96, 160);
  const coverHeight = Math.round(coverWidth * 1.5);

  const { pluginId, novelPath, novelName, coverUrl } = route.params;

  const installed = settings.extensions.installedPlugins || {};
  const plugin = installed[pluginId];

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [isDownloadMenuVisible, setIsDownloadMenuVisible] = useState(false);
  const [isMoreMenuVisible, setIsMoreMenuVisible] = useState(false);

  const title = detail?.name || novelName || "Novel";
  const cover = detail?.cover || coverUrl;
  const author = detail?.author || "";
  const status = detail?.status || "";
  const summary = detail?.summary || "";
  const genres: string[] = useMemo(
    () => (Array.isArray(detail?.genres) ? detail.genres : []),
    [detail],
  );
  const chapters: ChapterItem[] = useMemo(() => {
    const raw = detail?.chapters;
    if (!Array.isArray(raw)) return [];
    return raw.filter(isChapterItem);
  }, [detail]);

  useEffect(() => {
    const run = async () => {
      if (!plugin) {
        setError("Plugin not installed.");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        const instance = await PluginRuntimeService.loadLnReaderPlugin(plugin, {
          userAgent: settings.advanced.userAgent,
        });

        const parseNovel =
          instance.parseNovelAndChapters || instance.parseNovel;

        if (!parseNovel) {
          throw new Error("This plugin does not support novel details.");
        }

        const data = await parseNovel(novelPath);
        setDetail(data);
      } catch (e: any) {
        setError(e?.message || "Failed to load novel details.");
      } finally {
        setIsLoading(false);
      }
    };
    run();
  }, [novelPath, plugin, settings.advanced.userAgent]);

  const stableNumericId = useMemo(() => {
    const input = `${pluginId}:${novelPath}`;
    let hash = 2166136261;
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return String(hash >>> 0);
  }, [novelPath, pluginId]);

  const existingNovel = useMemo(
    () => novels.find((n) => n.id === stableNumericId),
    [novels, stableNumericId],
  );

  const [isInLibrary, setIsInLibrary] = useState(
    Boolean(existingNovel?.isInLibrary),
  );

  useEffect(() => {
    setIsInLibrary(Boolean(existingNovel?.isInLibrary));
  }, [existingNovel?.isInLibrary]);

  const normalizedStatus: Novel["status"] = useMemo(() => {
    const s = String(status || "").toLowerCase();
    if (s.includes("complete") || s.includes("end") || s.includes("finished"))
      return "completed";
    return "ongoing";
  }, [status]);

  const buildLibraryNovel = (nextInLibrary: boolean): Novel => {
    const totalChapters = chapters.length || existingNovel?.totalChapters || 0;
    const lastReadChapter = existingNovel?.lastReadChapter || 0;
    const unreadChapters =
      existingNovel?.unreadChapters ??
      Math.max(0, totalChapters - lastReadChapter);

    return {
      id: stableNumericId,
      title,
      author: author || "Unknown",
      coverUrl: cover || "https://via.placeholder.com/300x450",
      status: normalizedStatus,
      source: plugin?.name || pluginId,
      summary: summary || "",
      genres,
      totalChapters,
      unreadChapters: Math.min(unreadChapters, totalChapters),
      lastReadChapter,
      lastReadDate: existingNovel?.lastReadDate,
      isDownloaded: existingNovel?.isDownloaded ?? false,
      isInLibrary: nextInLibrary,
      categoryId: existingNovel?.categoryId || "reading",
      pluginId,
      pluginNovelPath: novelPath,
    };
  };

  const handleLibraryToggle = () => {
    const next = !isInLibrary;
    setIsInLibrary(next);

    if (!existingNovel) {
      addNovel(buildLibraryNovel(true));
      return;
    }

    updateNovel(stableNumericId, buildLibraryNovel(next));
  };

  const handleWebView = () => {
    const url = detail?.url || plugin?.site || plugin?.url || "";
    if (url) navigation.navigate("WebView", { url });
  };

  const handleProgressPress = () => {
    const first = chapters[0];
    if (!first) return;
    navigation.navigate("PluginReader", {
      pluginId,
      chapterPath: first.path,
      chapterTitle: first.name,
    });
  };

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

  const moreOptions = [{ id: "openWeb", label: "Open website", onPress: handleWebView }];

  const progressTotal = chapters.length || existingNovel?.totalChapters || 0;
  const progressUnread = existingNovel?.unreadChapters ?? progressTotal;
  const progressPercent =
    progressTotal > 0
      ? ((progressTotal - progressUnread) / progressTotal) * 100
      : 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Header
        title=""
        onBackPress={() => navigation.goBack()}
        rightButtons={
          <>
            <TouchableOpacity onPress={() => {}} style={styles.iconButton}>
              <Ionicons
                name="document-text"
                size={24}
                color={theme.colors.text}
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => {}} style={styles.iconButton}>
              <Ionicons
                name="share-outline"
                size={24}
                color={theme.colors.text}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setIsDownloadMenuVisible(true)}
              style={styles.iconButton}
            >
              <Ionicons
                name="download-outline"
                size={24}
                color={theme.colors.text}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setIsMoreMenuVisible(true)}
              style={styles.iconButton}
            >
              <Ionicons
                name="ellipsis-vertical"
                size={24}
                color={theme.colors.text}
              />
            </TouchableOpacity>
          </>
        }
      />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={[styles.centerText, { color: theme.colors.textSecondary }]}>
            Loading...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: theme.colors.error }]}>
            {error}
          </Text>
        </View>
      ) : (
        <FlatList
          data={chapters}
          keyExtractor={(item) => item.path}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <>
              <View style={styles.headerSection}>
                <Image
                  source={{
                    uri: cover || "https://via.placeholder.com/300x450",
                  }}
                  style={[
                    styles.cover,
                    { width: coverWidth, height: coverHeight },
                  ]}
                />
                <View style={styles.headerInfo}>
                  <Text
                    style={[styles.title, { color: theme.colors.text }]}
                    numberOfLines={3}
                  >
                    {title}
                  </Text>
                  <Text
                    style={[
                      styles.author,
                      { color: theme.colors.textSecondary },
                    ]}
                    numberOfLines={1}
                  >
                    {author || "Unknown"}
                  </Text>
                  <View style={styles.statusRow}>
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor:
                            normalizedStatus === "completed"
                              ? theme.colors.success
                              : theme.colors.warning,
                        },
                      ]}
                    >
                      <Text style={styles.statusText}>
                        {normalizedStatus}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.source,
                        { color: theme.colors.textSecondary },
                      ]}
                      numberOfLines={1}
                    >
                      {plugin?.name || pluginId}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    { backgroundColor: theme.colors.primary },
                  ]}
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
                  <Text
                    style={[
                      styles.actionButtonText,
                      { color: theme.colors.text },
                    ]}
                  >
                    WebView
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                  Summary
                </Text>
                <Text
                  style={[styles.summary, { color: theme.colors.textSecondary }]}
                >
                  {summary || "(No summary)"}
                </Text>
              </View>

              {genres.length > 0 ? (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                    Genres
                  </Text>
                  <View style={styles.genresContainer}>
                    {genres.map((g) => (
                      <View
                        key={g}
                        style={[
                          styles.genreTag,
                          {
                            backgroundColor: theme.colors.surface,
                            borderColor: theme.colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.genreText,
                            { color: theme.colors.primary },
                          ]}
                        >
                          {g}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              <TouchableOpacity
                style={styles.progressSection}
                onPress={handleProgressPress}
                disabled={chapters.length === 0}
              >
                <View style={styles.progressInfo}>
                  <Text style={[styles.progressText, { color: theme.colors.text }]}>
                    Progress
                  </Text>
                  <Text
                    style={[
                      styles.progressText,
                      { color: theme.colors.primary },
                    ]}
                  >
                    {progressTotal - progressUnread}/{progressTotal}
                  </Text>
                </View>
                <View
                  style={[
                    styles.progressBar,
                    { backgroundColor: theme.colors.border },
                  ]}
                >
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
                <Text
                  style={[styles.chapterCount, { color: theme.colors.textSecondary }]}
                >
                  {progressTotal} chapters
                </Text>
              </TouchableOpacity>

              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                  Chapters
                </Text>
              </View>
            </>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.chapterItem,
                { borderBottomColor: theme.colors.divider },
              ]}
              onPress={() =>
                navigation.navigate("PluginReader", {
                  pluginId,
                  chapterPath: item.path,
                  chapterTitle: item.name,
                })
              }
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={[styles.chapterTitle, { color: theme.colors.text }]}
                  numberOfLines={2}
                >
                  {item.name}
                </Text>
                {!!item.releaseTime && (
                  <Text
                    style={[
                      styles.chapterMeta,
                      { color: theme.colors.textSecondary },
                    ]}
                    numberOfLines={1}
                  >
                    {item.releaseTime}
                  </Text>
                )}
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.colors.textSecondary}
              />
            </TouchableOpacity>
          )}
        />
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
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 10,
  },
  centerText: {
    fontSize: 12,
  },
  errorText: {
    fontSize: 13,
    textAlign: "center",
  },
  listContent: {
    paddingBottom: 24,
  },
  headerSection: {
    flexDirection: "row",
    padding: 16,
  },
  cover: {
    borderRadius: 8,
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
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  chapterTitle: {
    fontSize: 14,
    flex: 1,
    fontWeight: "600",
  },
  chapterMeta: {
    fontSize: 11,
    marginTop: 4,
  },
});
