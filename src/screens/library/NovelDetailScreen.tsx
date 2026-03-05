// src/screens/library/NovelDetailScreen.tsx
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
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
import { NovelDetailCache } from "../../services/novelDetailCache";
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
  const { novels, updateNovel, removeNovel, categories } = useLibrary();
  const { width } = useWindowDimensions();

  const coverWidth = clamp(Math.round(Math.min(width * 0.28, 160)), 96, 160);
  const coverHeight = Math.round(coverWidth * 1.5);

  const { novelId } = route.params as { novelId: string };
  const novel = useMemo(() => novels.find((n) => n.id === novelId), [novels, novelId]);
  const linkedPlugin = useMemo(() => {
    if (!novel?.pluginId) return undefined;
    return settings.extensions.installedPlugins?.[novel.pluginId];
  }, [novel?.pluginId, settings.extensions.installedPlugins]);

  const cacheKey = useMemo(() => {
    if (!novel?.pluginId || !novel?.pluginNovelPath) return null;
    return NovelDetailCache.key(novel.pluginId, novel.pluginNovelPath);
  }, [novel?.pluginId, novel?.pluginNovelPath]);

  const fetchSignature = useMemo(() => {
    if (!novel?.pluginId || !novel?.pluginNovelPath) return null;
    return NovelDetailCache.signature({
      novelId: novel.id,
      pluginId: novel.pluginId,
      novelPath: novel.pluginNovelPath,
      pluginVersion: linkedPlugin?.version,
      pluginUrl: linkedPlugin?.url,
      pluginLocalPath: linkedPlugin?.localPath,
      userAgent: settings.advanced.userAgent,
    });
  }, [
    linkedPlugin?.localPath,
    linkedPlugin?.url,
    linkedPlugin?.version,
    novel?.id,
    novel?.pluginId,
    novel?.pluginNovelPath,
    settings.advanced.userAgent,
  ]);

  const initialCached = useMemo(() => {
    if (!cacheKey) return undefined;
    return NovelDetailCache.get(cacheKey);
  }, [cacheKey]);

  const [isDownloadMenuVisible, setIsDownloadMenuVisible] = useState(false);
  const [isMoreMenuVisible, setIsMoreMenuVisible] = useState(false);
  const [isInLibrary, setIsInLibrary] = useState(Boolean(novel?.isInLibrary));

  const [remoteDetail, setRemoteDetail] = useState<any>(
    () => initialCached?.detail ?? null,
  );
  const [remoteChapters, setRemoteChapters] = useState<PluginChapterItem[]>(
    () => initialCached?.chapters ?? [],
  );
  const [isRemoteLoading, setIsRemoteLoading] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const lastFetchKeyRef = useRef<string | null>(initialCached?.signature ?? null);
  const [chaptersPage, setChaptersPage] = useState(
    () => initialCached?.chaptersPage ?? 1,
  );
  const [chaptersHasMore, setChaptersHasMore] = useState(
    () => initialCached?.chaptersHasMore ?? false,
  );
  const [isChaptersLoadingMore, setIsChaptersLoadingMore] = useState(false);

  useEffect(() => {
    if (!novel?.pluginId) return;
    if (!linkedPlugin?.url?.startsWith("novelnest-api|")) return;
    const total =
      typeof remoteDetail?.totalChapters === "number"
        ? remoteDetail.totalChapters
        : undefined;
    if (total == null) return;
    setChaptersHasMore(remoteChapters.length < total);
  }, [linkedPlugin?.url, novel?.pluginId, remoteChapters.length, remoteDetail?.totalChapters]);

  const categoryChoices = useMemo(() => {
    const list = Array.isArray(categories) ? categories : [];
    return list
      .filter((c) => c && c.id && c.id !== "all")
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [categories]);

  const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false);
  const [pendingCategoryId, setPendingCategoryId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!isCategoryModalVisible) return;
    if (pendingCategoryId) return;
    const existing = novel?.categoryId;
    const fallback =
      (existing && categoryChoices.some((c) => c.id === existing) && existing) ||
      categoryChoices[0]?.id ||
      null;
    setPendingCategoryId(fallback);
  }, [
    categoryChoices,
    isCategoryModalVisible,
    novel?.categoryId,
    pendingCategoryId,
  ]);

  useEffect(() => {
    setIsInLibrary(Boolean(novel?.isInLibrary));
  }, [novel?.isInLibrary]);

  useEffect(() => {
    const run = async () => {
      if (!novel?.pluginId || !novel?.pluginNovelPath) return;

      const stableKey =
        cacheKey ?? NovelDetailCache.key(novel.pluginId, novel.pluginNovelPath);
      const cached = NovelDetailCache.get(stableKey);

      if (cached) {
        setRemoteError(null);
        setRemoteDetail(cached.detail);
        setRemoteChapters(cached.chapters);
        setChaptersPage(cached.chaptersPage);
        setChaptersHasMore(cached.chaptersHasMore);

        if (cached.detail) {
          const resolvedTitle = String(cached.detail?.name || novel.title);
          const resolvedAuthor = String(
            cached.detail?.author || novel.author || "Unknown",
          );
          const resolvedCover = String(cached.detail?.cover || novel.coverUrl);
          const resolvedSummary = String(cached.detail?.summary || novel.summary || "");
          const resolvedGenres = Array.isArray(cached.detail?.genres)
            ? cached.detail.genres.map((g: any) => String(g))
            : novel.genres;
          const resolvedTotalChapters =
            typeof cached.detail?.totalChapters === "number"
              ? cached.detail.totalChapters
              : undefined;

          const updates: Partial<Novel> = {};
          if (resolvedTitle && resolvedTitle !== novel.title) updates.title = resolvedTitle;
          if (resolvedAuthor && resolvedAuthor !== novel.author) updates.author = resolvedAuthor;
          if (resolvedCover && resolvedCover !== novel.coverUrl) updates.coverUrl = resolvedCover;
          if (resolvedSummary !== novel.summary) updates.summary = resolvedSummary;
          if (
            Array.isArray(cached.detail?.genres) &&
            (novel.genres.length !== resolvedGenres.length ||
              novel.genres.some((g, idx) => g !== resolvedGenres[idx]))
          ) {
            updates.genres = resolvedGenres;
          }
          if (
            resolvedTotalChapters != null &&
            resolvedTotalChapters !== novel.totalChapters
          ) {
            updates.totalChapters = resolvedTotalChapters;
          }

          if (Object.keys(updates).length > 0) {
            updateNovel(novel.id, updates);
          }
        }

        if (fetchSignature && cached.signature === fetchSignature) {
          lastFetchKeyRef.current = fetchSignature;
          return;
        }
      } else {
        setRemoteDetail(null);
        setRemoteChapters([]);
        setChaptersPage(1);
        setChaptersHasMore(false);
      }

      const plugin = linkedPlugin;
      if (!plugin) {
        setRemoteError("Source plugin is not installed.");
        return;
      }
      if (!plugin.enabled) {
        setRemoteError("Source plugin is disabled.");
        return;
      }

      const signature =
        fetchSignature ||
        NovelDetailCache.signature({
          novelId: novel.id,
          pluginId: novel.pluginId,
          novelPath: novel.pluginNovelPath,
          pluginVersion: plugin.version,
          pluginUrl: plugin.url,
          pluginLocalPath: plugin.localPath,
          userAgent: settings.advanced.userAgent,
        });

      // Prevent infinite refresh loops: `updateNovel()` changes library state which re-renders this screen.
      // We only refetch when the novel/plugin reference or runtime inputs change.
      if (lastFetchKeyRef.current === signature) return;
      lastFetchKeyRef.current = signature;

      setRemoteError(null);
      setChaptersPage(1);

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
        setChaptersPage(1);

        const totalFromDetail =
          typeof data?.totalChapters === "number" ? data.totalChapters : undefined;
        const hasMoreFromTotal =
          totalFromDetail != null
            ? chaptersMapped.length < totalFromDetail
            : false;
        setChaptersHasMore(
          typeof (instance as any).fetchChaptersPage === "function" &&
            hasMoreFromTotal,
        );

        NovelDetailCache.set(stableKey, {
          signature,
          cachedAt: Date.now(),
          detail: data,
          chapters: chaptersMapped,
          chaptersPage: 1,
          chaptersHasMore:
            typeof (instance as any).fetchChaptersPage === "function" &&
            hasMoreFromTotal,
        });

        updateNovel(novel.id, {
          title: String(data?.name || novel.title),
          author: String(data?.author || novel.author || "Unknown"),
          coverUrl: String(data?.cover || novel.coverUrl),
          summary: String(data?.summary || novel.summary || ""),
          genres: Array.isArray(data?.genres) ? data.genres : novel.genres,
          totalChapters:
            totalFromDetail != null
              ? totalFromDetail
              : chaptersMapped.length || novel.totalChapters,
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
    cacheKey,
    fetchSignature,
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
    if (isInLibrary) {
      removeNovel(novel.id);
      (navigation as any).goBack();
      return;
    }

    if (categoryChoices.length === 0) {
      setIsInLibrary(true);
      updateNovel(novel.id, { isInLibrary: true });
      return;
    }

    if (categoryChoices.length === 1) {
      setIsInLibrary(true);
      updateNovel(novel.id, {
        isInLibrary: true,
        categoryId: categoryChoices[0].id,
      });
      return;
    }

    setPendingCategoryId(null);
    setIsCategoryModalVisible(true);
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

  const loadMoreChapters = async () => {
    if (!novel?.pluginId || !novel?.pluginNovelPath) return;
    if (!linkedPlugin || !linkedPlugin.enabled) return;
    if (!chaptersHasMore || isRemoteLoading || isChaptersLoadingMore) return;

    try {
      setIsChaptersLoadingMore(true);
      const instance = await PluginRuntimeService.loadLnReaderPlugin(linkedPlugin, {
        userAgent: settings.advanced.userAgent,
      });
      if (typeof (instance as any).fetchChaptersPage !== "function") {
        setChaptersHasMore(false);
        return;
      }
      const nextPage = chaptersPage + 1;
      const res = await (instance as any).fetchChaptersPage(
        novel.pluginNovelPath,
        nextPage,
      );

      const raw = Array.isArray(res?.chapters) ? res.chapters : [];
      const mapped = raw.filter(isPluginChapterItem);
      const appliedPage = typeof res?.page === "number" ? res.page : nextPage;
      const explicitHasMore =
        typeof res?.hasMore === "boolean" ? res.hasMore : undefined;
      const totalFromDetail =
        typeof remoteDetail?.totalChapters === "number"
          ? remoteDetail.totalChapters
          : undefined;
      const stableKey =
        cacheKey ?? NovelDetailCache.key(novel.pluginId, novel.pluginNovelPath);
      const signature =
        fetchSignature ||
        NovelDetailCache.signature({
          novelId: novel.id,
          pluginId: novel.pluginId,
          novelPath: novel.pluginNovelPath,
          pluginVersion: linkedPlugin?.version,
          pluginUrl: linkedPlugin?.url,
          pluginLocalPath: linkedPlugin?.localPath,
          userAgent: settings.advanced.userAgent,
        });

      setRemoteChapters((prev) => {
        const seen = new Set(prev.map((c) => c.path));
        const next = [...prev];
        for (const c of mapped) {
          if (!seen.has(c.path)) next.push(c);
        }

        const nextHasMore =
          typeof explicitHasMore === "boolean"
            ? explicitHasMore
            : totalFromDetail != null
              ? next.length < totalFromDetail
              : mapped.length > 0;

        setChaptersPage(appliedPage);
        setChaptersHasMore(nextHasMore);

        const cacheDetail =
          remoteDetail ?? NovelDetailCache.get(stableKey)?.detail ?? null;
        NovelDetailCache.set(stableKey, {
          signature,
          cachedAt: Date.now(),
          detail: cacheDetail,
          chapters: next,
          chaptersPage: appliedPage,
          chaptersHasMore: nextHasMore,
        });

        return next;
      });
    } catch {
      // ignore
    } finally {
      setIsChaptersLoadingMore(false);
    }
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

          {isRemoteLoading && !remoteDetail && remoteChapters.length === 0 ? (
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
              style={[
                styles.actionButton,
                isInLibrary
                  ? {
                      backgroundColor: theme.colors.surface,
                      borderWidth: 1,
                      borderColor: theme.colors.border,
                    }
                  : { backgroundColor: theme.colors.primary },
              ]}
              onPress={handleLibraryToggle}
            >
              <Text
                style={[
                  styles.actionButtonText,
                  { color: isInLibrary ? theme.colors.text : "#FFF" },
                ]}
              >
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

            {novel.pluginId && chaptersHasMore ? (
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
            ) : null}
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
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
            onPress={() => {}}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                Add to category
              </Text>
              <Text
                style={[
                  styles.modalSubtitle,
                  { color: theme.colors.textSecondary },
                ]}
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
                    style={[styles.categoryRow, { borderColor: theme.colors.divider }]}
                    onPress={() => setPendingCategoryId(c.id)}
                  >
                    <Text
                      style={[
                        styles.categoryLabel,
                        { color: theme.colors.text },
                      ]}
                    >
                      {c.name}
                    </Text>
                    <Ionicons
                      name={selected ? "checkmark-circle" : "ellipse-outline"}
                      size={22}
                      color={
                        selected
                          ? theme.colors.primary
                          : theme.colors.textSecondary
                      }
                    />
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                  },
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
                  if (!novel || !pendingCategoryId) return;
                  setIsInLibrary(true);
                  updateNovel(novel.id, {
                    isInLibrary: true,
                    categoryId: pendingCategoryId,
                  });
                  setIsCategoryModalVisible(false);
                }}
              >
                <Text
                  style={[
                    styles.modalButtonText,
                    {
                      color: pendingCategoryId ? "#FFF" : theme.colors.textSecondary,
                    },
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
  loadMoreButton: {
    marginTop: 12,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  loadMoreText: {
    fontWeight: "800",
    color: "#FFF",
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
});
