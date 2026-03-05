import { Ionicons } from "@expo/vector-icons";
import type { RouteProp } from "@react-navigation/native";
import { useNavigation, useRoute } from "@react-navigation/native";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
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
import {
  NovelDetailCache,
  normalizePluginDetailForCache,
} from "../../services/novelDetailCache";
import { PluginRuntimeService } from "../../services/pluginRuntime";
import type { CachedPluginNovelDetail, Novel } from "../../types";
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
  const { novels, addNovel, updateNovel, categories } = useLibrary();
  const { width } = useWindowDimensions();

  const coverWidth = clamp(Math.round(Math.min(width * 0.28, 160)), 96, 160);
  const coverHeight = Math.round(coverWidth * 1.5);

  const { pluginId, novelPath, novelName, coverUrl } = route.params;

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

  const installed = settings.extensions.installedPlugins || {};
  const plugin = installed[pluginId];

  const cacheKey = useMemo(
    () => NovelDetailCache.key(pluginId, novelPath),
    [pluginId, novelPath],
  );

  const fetchSignature = useMemo(() => {
    return NovelDetailCache.signature({
      novelId: stableNumericId,
      pluginId,
      novelPath,
      pluginVersion: plugin?.version,
      pluginUrl: plugin?.url,
      pluginLocalPath: plugin?.localPath,
      userAgent: settings.advanced.userAgent,
    });
  }, [
    novelPath,
    plugin?.localPath,
    plugin?.url,
    plugin?.version,
    pluginId,
    settings.advanced.userAgent,
    stableNumericId,
  ]);

  const initialCached = useMemo((): CachedPluginNovelDetail | undefined => {
    const persisted = existingNovel?.pluginCache;
    const mem = NovelDetailCache.get(cacheKey);
    if (!mem) return persisted;
    if (!persisted) return mem;
    return (mem.cachedAt ?? 0) >= (persisted.cachedAt ?? 0) ? mem : persisted;
  }, [cacheKey, existingNovel?.pluginCache]);

  const [isLoading, setIsLoading] = useState(() => !initialCached);
  const [error, setError] = useState<string | null>(null);
  const [remoteDetail, setRemoteDetail] = useState<any>(
    () => initialCached?.detail ?? null,
  );
  const [remoteChapters, setRemoteChapters] = useState<ChapterItem[]>(
    () => initialCached?.chapters?.filter(isChapterItem) ?? [],
  );
  const [isDownloadMenuVisible, setIsDownloadMenuVisible] = useState(false);
  const [isMoreMenuVisible, setIsMoreMenuVisible] = useState(false);
  const [chaptersPage, setChaptersPage] = useState(
    () => initialCached?.chaptersPage ?? 1,
  );
  const [chaptersHasMore, setChaptersHasMore] = useState(
    () => initialCached?.chaptersHasMore ?? false,
  );
  const [isChaptersLoadingMore, setIsChaptersLoadingMore] = useState(false);
  const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false);
  const [pendingCategoryId, setPendingCategoryId] = useState<string | null>(
    null,
  );

  const title = remoteDetail?.name || novelName || "Novel";
  const cover = remoteDetail?.cover || coverUrl;
  const author = remoteDetail?.author || "";
  const status = remoteDetail?.status || "";
  const summary = remoteDetail?.summary || "";
  const genres: string[] = useMemo(
    () => (Array.isArray(remoteDetail?.genres) ? remoteDetail.genres : []),
    [remoteDetail],
  );
  const chapters: ChapterItem[] = remoteChapters;

  useEffect(() => {
    const run = async () => {
      const mem = NovelDetailCache.get(cacheKey);
      const persisted = existingNovel?.pluginCache;
      const cached =
        mem && persisted
          ? (mem.cachedAt ?? 0) >= (persisted.cachedAt ?? 0)
            ? mem
            : persisted
          : mem ?? persisted;

      if (cached && cached !== mem) {
        NovelDetailCache.set(cacheKey, cached);
      }

      if (cached) {
        setError(null);
        setRemoteDetail(cached.detail);
        setRemoteChapters(
          Array.isArray(cached.chapters) ? cached.chapters.filter(isChapterItem) : [],
        );
        setChaptersPage(cached.chaptersPage);
        setChaptersHasMore(cached.chaptersHasMore);
        setIsLoading(false);
        if (cached.signature === fetchSignature) return;
      }

      if (!plugin) {
        if (!cached) {
          setError("Plugin not installed.");
          setIsLoading(false);
        }
        return;
      }

      try {
        if (!cached) setIsLoading(true);
        setError(null);
        if (!cached) {
          setChaptersPage(1);
          setChaptersHasMore(false);
        }
        const instance = await PluginRuntimeService.loadLnReaderPlugin(plugin, {
          userAgent: settings.advanced.userAgent,
        });

        const parseNovel =
          instance.parseNovelAndChapters || instance.parseNovel;

        if (!parseNovel) {
          throw new Error("This plugin does not support novel details.");
        }

        const data = await parseNovel(novelPath);
        const normalizedDetail = normalizePluginDetailForCache(data);
        setRemoteDetail(normalizedDetail);

        const totalFromDetail = normalizedDetail?.totalChapters;
        const initialChapters = Array.isArray(data?.chapters) ? data.chapters : [];
        const chaptersMapped = initialChapters
          .filter(isChapterItem)
          .map((c: any) => ({
            name: String(c?.name || ""),
            path: String(c?.path || ""),
            releaseTime: c?.releaseTime ?? null,
            chapterNumber:
              typeof c?.chapterNumber === "number" ? c.chapterNumber : undefined,
          }));
        setRemoteChapters(chaptersMapped);

        const hasMoreFromTotal =
          totalFromDetail != null ? chaptersMapped.length < totalFromDetail : false;
        const canPage = typeof (instance as any).fetchChaptersPage === "function";
        const hasMore = canPage && hasMoreFromTotal;

        setChaptersPage(1);
        setChaptersHasMore(hasMore);

        const cacheEntry: CachedPluginNovelDetail = {
          signature: fetchSignature,
          cachedAt: Date.now(),
          detail: normalizedDetail,
          chapters: chaptersMapped,
          chaptersPage: 1,
          chaptersHasMore: hasMore,
        };

        NovelDetailCache.set(cacheKey, cacheEntry);
        updateNovel(stableNumericId, { pluginCache: cacheEntry });
      } catch (e: any) {
        if (!cached) {
          setError(e?.message || "Failed to load novel details.");
        }
      } finally {
        setIsLoading(false);
      }
    };
    run();
  }, [
    cacheKey,
    existingNovel?.pluginCache,
    fetchSignature,
    novelPath,
    plugin,
    settings.advanced.userAgent,
    stableNumericId,
    updateNovel,
  ]);

  useEffect(() => {
    if (!plugin) return;
    if (!plugin.url?.startsWith("novelnest-api|")) return;
    const total =
      typeof remoteDetail?.totalChapters === "number"
        ? remoteDetail.totalChapters
        : undefined;
    if (total == null) return;
    setChaptersHasMore(chapters.length < total);
  }, [chapters.length, plugin, remoteDetail?.totalChapters]);

  const loadMoreChapters = async () => {
    if (!plugin) return;
    if (!chaptersHasMore || isLoading || isChaptersLoadingMore) return;

    try {
      setIsChaptersLoadingMore(true);
      const instance = await PluginRuntimeService.loadLnReaderPlugin(plugin, {
        userAgent: settings.advanced.userAgent,
      });
      if (typeof (instance as any).fetchChaptersPage !== "function") {
        setChaptersHasMore(false);
        return;
      }

      const nextPage = chaptersPage + 1;
      const res = await (instance as any).fetchChaptersPage(novelPath, nextPage);
      const raw = Array.isArray(res?.chapters) ? res.chapters : [];
      const mapped = raw.filter(isChapterItem);

      const appliedPage = typeof res?.page === "number" ? res.page : nextPage;
      const explicitHasMore =
        typeof res?.hasMore === "boolean" ? res.hasMore : undefined;

      const seen = new Set(remoteChapters.map((c) => c.path));
      const next = [...remoteChapters];
      for (const c of mapped) {
        if (!seen.has(c.path)) next.push(c);
      }

      const totalFromDetail =
        typeof remoteDetail?.totalChapters === "number"
          ? remoteDetail.totalChapters
          : undefined;
      const nextHasMore =
        typeof explicitHasMore === "boolean"
          ? explicitHasMore
          : totalFromDetail != null
            ? next.length < totalFromDetail
            : mapped.length > 0;

      setRemoteChapters(next);
      setChaptersPage(appliedPage);
      setChaptersHasMore(nextHasMore);

      const cacheDetail =
        remoteDetail ??
        NovelDetailCache.get(cacheKey)?.detail ??
        existingNovel?.pluginCache?.detail ??
        null;

      const cacheEntry: CachedPluginNovelDetail = {
        signature: fetchSignature,
        cachedAt: Date.now(),
        detail: cacheDetail,
        chapters: next,
        chaptersPage: appliedPage,
        chaptersHasMore: nextHasMore,
      };

      NovelDetailCache.set(cacheKey, cacheEntry);
      updateNovel(stableNumericId, { pluginCache: cacheEntry });
    } catch {
      // ignore
    } finally {
      setIsChaptersLoadingMore(false);
    }
  };

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
    const totalChapters =
      typeof remoteDetail?.totalChapters === "number"
        ? remoteDetail.totalChapters
        : chapters.length || existingNovel?.totalChapters || 0;
    const lastReadChapter = existingNovel?.lastReadChapter || 0;
    const unreadChapters =
      existingNovel?.unreadChapters ??
      Math.max(0, totalChapters - lastReadChapter);

    const cacheFromMemory = NovelDetailCache.get(cacheKey);
    const pluginCache = cacheFromMemory ?? existingNovel?.pluginCache;

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
      pluginCache,
    };
  };

  const categoryChoices = useMemo(() => {
    const list = Array.isArray(categories) ? categories : [];
    return list
      .filter((c) => c && c.id && c.id !== "all")
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [categories]);

  useEffect(() => {
    if (!isCategoryModalVisible) return;
    if (pendingCategoryId) return;
    const existing = existingNovel?.categoryId;
    const fallback =
      (existing && categoryChoices.some((c) => c.id === existing) && existing) ||
      categoryChoices[0]?.id ||
      null;
    setPendingCategoryId(fallback);
  }, [categoryChoices, existingNovel?.categoryId, isCategoryModalVisible, pendingCategoryId]);

  const upsertLibraryNovel = (nextInLibrary: boolean, categoryId?: string) => {
    const base = buildLibraryNovel(nextInLibrary);
    const withCategory = categoryId ? { ...base, categoryId } : base;

    if (!existingNovel) {
      addNovel({ ...withCategory, isInLibrary: true });
      return;
    }
    updateNovel(stableNumericId, withCategory);
  };

  const handleLibraryToggle = () => {
    const next = !isInLibrary;
    setIsInLibrary(next);
    upsertLibraryNovel(next);
  };

  const handleAddToLibrary = () => {
    if (isInLibrary) return;

    if (categoryChoices.length === 0) {
      setIsInLibrary(true);
      upsertLibraryNovel(true);
      return;
    }

    if (categoryChoices.length === 1) {
      setIsInLibrary(true);
      upsertLibraryNovel(true, categoryChoices[0].id);
      return;
    }

    setPendingCategoryId(null);
    setIsCategoryModalVisible(true);
  };

  const handleWebView = () => {
    const url = remoteDetail?.url || plugin?.site || plugin?.url || "";
    if (url) navigation.navigate("WebView", { url });
  };

  const handleProgressPress = () => {
    const first = chapters[0];
    if (!first) return;
    navigation.navigate("PluginReader", {
      pluginId,
      novelId: stableNumericId,
      novelPath,
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
                  onPress={isInLibrary ? handleLibraryToggle : handleAddToLibrary}
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
                  novelId: stableNumericId,
                  novelPath,
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

      {chaptersHasMore && !isLoading && !error ? (
        <View style={styles.loadMoreWrap}>
          <TouchableOpacity
            style={[
              styles.loadMoreButton,
              {
                backgroundColor: isChaptersLoadingMore
                  ? theme.colors.border
                  : theme.colors.primary,
              },
            ]}
            disabled={isChaptersLoadingMore}
            onPress={loadMoreChapters}
          >
            <Text style={styles.loadMoreText}>
              {isChaptersLoadingMore ? "Loading..." : "Load more chapters"}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

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

      <Modal
        visible={isCategoryModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCategoryModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsCategoryModalVisible(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[
              styles.modalCard,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
            ]}
            onPress={() => {}}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                Add to category
              </Text>
              <Text
                style={[styles.modalSubtitle, { color: theme.colors.textSecondary }]}
              >
                Choose a category, then tap Add.
              </Text>
            </View>

            <View style={styles.modalList}>
              {categoryChoices.map((c) => {
                const selected = pendingCategoryId === c.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[
                      styles.categoryRow,
                      { borderColor: theme.colors.divider },
                    ]}
                    onPress={() => setPendingCategoryId(c.id)}
                  >
                    <Text style={[styles.categoryLabel, { color: theme.colors.text }]}>
                      {c.name}
                    </Text>
                    <Ionicons
                      name={selected ? "checkmark-circle" : "ellipse-outline"}
                      size={22}
                      color={selected ? theme.colors.primary : theme.colors.textSecondary}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                ]}
                onPress={() => setIsCategoryModalVisible(false)}
              >
                <Text style={[styles.modalButtonText, { color: theme.colors.text }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={!pendingCategoryId}
                style={[
                  styles.modalButton,
                  {
                    backgroundColor: pendingCategoryId
                      ? theme.colors.primary
                      : theme.colors.border,
                    borderColor: "transparent",
                  },
                ]}
                onPress={() => {
                  if (!pendingCategoryId) return;
                  setIsInLibrary(true);
                  upsertLibraryNovel(true, pendingCategoryId);
                  setIsCategoryModalVisible(false);
                }}
              >
                <Text
                  style={[
                    styles.modalButtonText,
                    { color: pendingCategoryId ? "#FFF" : theme.colors.textSecondary },
                  ]}
                >
                  Add
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    padding: 18,
    justifyContent: "center",
  },
  modalCard: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: "hidden",
  },
  modalHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
    gap: 6,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  modalSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  modalList: {
    paddingHorizontal: 10,
    paddingBottom: 6,
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
    paddingRight: 12,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    padding: 12,
  },
  modalButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
  },
  modalButtonText: {
    fontWeight: "800",
  },
  loadMoreWrap: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  loadMoreButton: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  loadMoreText: {
    fontWeight: "800",
    color: "#FFF",
  },
});
