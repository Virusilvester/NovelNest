// src/screens/library/NovelDetailScreen.tsx
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View
} from "react-native";
import { Header } from "../../components/common/Header";
import { PopupMenu } from "../../components/common/PopupMenu";
import { useDownloadQueue } from "../../context/DownloadQueueContext";
import { useLibrary } from "../../context/LibraryContext";
import { useSettings } from "../../context/SettingsContext";
import { useTheme } from "../../context/ThemeContext";
import { ChapterDownloads } from "../../services/chapterDownloads";
import {
  normalizePluginDetailForCache,
  NovelDetailCache,
} from "../../services/novelDetailCache";
import { PluginRuntimeService } from "../../services/pluginRuntime";
import type { CachedPluginNovelDetail, Novel } from "../../types";
import {
  computeTotalEffectiveReadCount,
  detectChapterListOrder,
  getEffectiveReadForChapter,
  updateReadOverridesForSelection,
} from "../../utils/chapterState";
import { clamp } from "../../utils/responsive";

// Memoized chapter item component for performance
const ChapterItem = React.memo(({ 
  item, 
  index, 
  selected, 
  isRead, 
  downloadInfo, 
  isDownloaded, 
  isChapterSelectionMode,
  theme,
  toggleChapterSelected,
  handlePluginChapterPress,
  enqueueChapterDownload
}: {
  item: PluginChapterItem;
  index: number;
  selected: boolean;
  isRead: boolean;
  downloadInfo: any;
  isDownloaded: boolean;
  isChapterSelectionMode: boolean;
  theme: any;
  toggleChapterSelected: (path: string) => void;
  handlePluginChapterPress: (chapter: PluginChapterItem) => void;
  enqueueChapterDownload: (chapter: PluginChapterItem) => void;
}) => {
  const c = item;

  return (
    <TouchableOpacity
      key={c.path}
      style={[
        styles.chapterItem,
        selected && {
          backgroundColor: theme.colors.primary + "1A",
        },
        { borderBottomColor: theme.colors.divider },
      ]}
      onPress={() => {
        if (isChapterSelectionMode) {
          toggleChapterSelected(c.path);
          return;
        }
        handlePluginChapterPress(c);
      }}
      onLongPress={() => toggleChapterSelected(c.path)}
      delayLongPress={220}
    >
      <View style={styles.chapterLeft}>
        {isChapterSelectionMode ? (
          <Ionicons
            name={selected ? "checkmark-circle" : "ellipse-outline"}
            size={22}
            color={selected ? theme.colors.primary : theme.colors.textSecondary}
          />
        ) : null}
        <Text
          style={[
            styles.chapterTitle,
            { color: isRead ? theme.colors.textSecondary : theme.colors.text },
          ]}
          numberOfLines={2}
        >
          {c.name}
        </Text>
      </View>
      {!isChapterSelectionMode ? (
        <View style={styles.chapterRight}>
          <TouchableOpacity
            onPress={() => {
              if (isDownloaded) return;
              if (
                downloadInfo?.status === "pending" ||
                downloadInfo?.status === "downloading"
              ) {
                return;
              }
              enqueueChapterDownload(c);
            }}
            style={[styles.chapterIconBtn, isDownloaded && { opacity: 0.65 }]}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            {isDownloaded ? (
              <Ionicons
                name="checkmark-circle"
                size={20}
                color={theme.colors.primary}
              />
            ) : downloadInfo?.status === "downloading" ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : downloadInfo?.status === "pending" ? (
              <Ionicons
                name="time-outline"
                size={20}
                color={theme.colors.textSecondary}
              />
            ) : downloadInfo?.status === "error" ? (
              <Ionicons
                name="alert-circle-outline"
                size={20}
                color={theme.colors.error}
              />
            ) : (
              <Ionicons
                name="download-outline"
                size={20}
                color={theme.colors.textSecondary}
              />
            )}
          </TouchableOpacity>

          <Ionicons
            name="chevron-forward"
            size={20}
            color={theme.colors.textSecondary}
          />
        </View>
      ) : null}
    </TouchableOpacity>
  );
});

ChapterItem.displayName = 'ChapterItem';

type PluginChapterItem = {
  name: string;
  path: string;
  releaseTime?: string | null;
  chapterNumber?: number;
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
  const { tasks: downloadTasks, enqueue, cancelTask, cancelNovelTasks } =
    useDownloadQueue();
  const { width } = useWindowDimensions();

  const coverWidth = clamp(Math.round(Math.min(width * 0.28, 160)), 96, 160);
  const coverHeight = Math.round(coverWidth * 1.5);

  const { novelId } = route.params as { novelId: string };
  const novel = useMemo(
    () => novels.find((n) => n.id === novelId),
    [novels, novelId],
  );

  const novelRef = useRef<Novel | undefined>(undefined);
  useEffect(() => {
    novelRef.current = novel || undefined;
  }, [novel]);

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

  const initialCached = useMemo((): CachedPluginNovelDetail | undefined => {
    const persisted = novel?.pluginCache;
    if (!cacheKey) return persisted;

    const mem = NovelDetailCache.get(cacheKey);
    if (!mem) return persisted;
    if (!persisted) return mem;
    return mem.cachedAt >= persisted.cachedAt ? mem : persisted;
  }, [cacheKey, novel?.pluginCache]);

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
  const lastFetchKeyRef = useRef<string | null>(
    initialCached?.signature ?? null,
  );
  const [chaptersPage, setChaptersPage] = useState(
    () => initialCached?.chaptersPage ?? 1,
  );
  const [chaptersHasMore, setChaptersHasMore] = useState(
    () => initialCached?.chaptersHasMore ?? false,
  );
  const [isChaptersLoadingMore, setIsChaptersLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Refresh function for pull-to-refresh
  const handleRefresh = useCallback(async () => {
    if (!novel?.pluginId || !novel?.pluginNovelPath) return;
    
    setIsRefreshing(true);
    try {
      // Clear the cache to force fresh fetch
      lastFetchKeyRef.current = null;
      
      // Trigger the existing fetch logic by resetting dependencies
      const plugin = linkedPlugin;
      if (!plugin) {
        setRemoteError("Source plugin is not installed.");
        return;
      }
      if (!plugin.enabled) {
        setRemoteError("Source plugin is disabled.");
        return;
      }

      const signature = NovelDetailCache.signature({
        novelId: novel.id,
        pluginId: novel.pluginId,
        novelPath: novel.pluginNovelPath,
        pluginVersion: plugin.version,
        pluginUrl: plugin.url,
        pluginLocalPath: plugin.localPath,
        userAgent: settings.advanced.userAgent,
      });

      setRemoteError(null);
      setChaptersPage(1);

      const instance = await PluginRuntimeService.loadLnReaderPlugin(plugin, {
        userAgent: settings.advanced.userAgent,
      });
      const parseNovel =
        (instance as any).parseNovelAndChapters ||
        (instance as any).parseNovel;
      if (typeof parseNovel !== "function") {
        throw new Error("This source does not support novel details.");
      }

      const data = await parseNovel(novel.pluginNovelPath);
      const normalizedDetail = normalizePluginDetailForCache(data);
      setRemoteDetail(normalizedDetail);

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

      const totalFromDetail = normalizedDetail?.totalChapters;
      const hasMoreFromTotal =
        totalFromDetail != null
          ? chaptersMapped.length < totalFromDetail
          : false;
      const canPage = typeof (instance as any).fetchChaptersPage === "function";
      setChaptersHasMore(canPage && hasMoreFromTotal);

      const cacheEntry: CachedPluginNovelDetail = {
        signature,
        cachedAt: Date.now(),
        detail: normalizedDetail,
        chapters: chaptersMapped,
        chaptersPage: 1,
        chaptersHasMore: canPage && hasMoreFromTotal,
      };

      NovelDetailCache.set(
        cacheKey ?? NovelDetailCache.key(novel.pluginId, novel.pluginNovelPath),
        cacheEntry
      );

      const statusRaw = String(normalizedDetail?.status || "").toLowerCase();
      const nextStatus: Novel["status"] = normalizedDetail?.status
        ? statusRaw.includes("complete") ||
            statusRaw.includes("end") ||
            statusRaw.includes("finished")
          ? "completed"
          : "ongoing"
        : novel.status;

      updateNovel(novel.id, {
        title: String(normalizedDetail?.name || novel.title),
        author: String(normalizedDetail?.author || novel.author || "Unknown"),
        coverUrl: String(normalizedDetail?.cover || novel.coverUrl),
        status: nextStatus,
        summary: String(normalizedDetail?.summary || novel.summary || ""),
        genres: Array.isArray(normalizedDetail?.genres)
          ? normalizedDetail.genres
          : novel.genres,
        totalChapters:
          totalFromDetail != null
            ? totalFromDetail
            : chaptersMapped.length || novel.totalChapters,
        pluginCache: cacheEntry,
      });

      console.log("🔄 Novel details refreshed successfully");
    } catch (e: any) {
      console.error("❌ Failed to refresh novel details:", e);
      setRemoteError(e?.message || "Failed to refresh novel details.");
    } finally {
      setIsRefreshing(false);
    }
  }, [novel, linkedPlugin, settings.advanced.userAgent, cacheKey, updateNovel]);

  const [selectedChapterPaths, setSelectedChapterPaths] = useState<Set<string>>(
    () => new Set(),
  );
  const [isChapterSelectionMenuVisible, setIsChapterSelectionMenuVisible] =
    useState(false);
  const isChapterSelectionMode = selectedChapterPaths.size > 0;

  useEffect(() => {
    if (selectedChapterPaths.size === 0 && isChapterSelectionMenuVisible) {
      setIsChapterSelectionMenuVisible(false);
    }
  }, [isChapterSelectionMenuVisible, selectedChapterPaths.size]);

  useEffect(() => {
    setSelectedChapterPaths((prev) => {
      if (prev.size === 0) return prev;
      const available = new Set(remoteChapters.map((c) => c.path));
      const next = new Set([...prev].filter((id) => available.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [remoteChapters]);

  useEffect(() => {
    if (!novel?.pluginId) return;
    if (!linkedPlugin?.url?.startsWith("novelnest-api|")) return;
    const total =
      typeof remoteDetail?.totalChapters === "number"
        ? remoteDetail.totalChapters
        : undefined;
    if (total == null) return;
    setChaptersHasMore(remoteChapters.length < total);
  }, [
    linkedPlugin?.url,
    novel?.pluginId,
    remoteChapters.length,
    remoteDetail?.totalChapters,
  ]);

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
      (existing &&
        categoryChoices.some((c) => c.id === existing) &&
        existing) ||
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
      const mem = NovelDetailCache.get(stableKey);
      const persisted = novel.pluginCache;
      const cached =
        mem && persisted
          ? mem.cachedAt >= persisted.cachedAt
            ? mem
            : persisted
          : (mem ?? persisted);

      if (cached && cached !== mem) {
        NovelDetailCache.set(stableKey, cached);
      }

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
          const resolvedSummary = String(
            cached.detail?.summary || novel.summary || "",
          );
          const resolvedGenres = Array.isArray(cached.detail?.genres)
            ? cached.detail.genres.map((g: any) => String(g))
            : novel.genres;
          const resolvedTotalChapters =
            typeof cached.detail?.totalChapters === "number"
              ? cached.detail.totalChapters
              : undefined;
          const resolvedStatusRaw = String(cached.detail?.status || "").toLowerCase();
          const resolvedStatus: Novel["status"] | undefined = cached.detail?.status
            ? resolvedStatusRaw.includes("complete") ||
                resolvedStatusRaw.includes("end") ||
                resolvedStatusRaw.includes("finished")
              ? "completed"
              : "ongoing"
            : undefined;

          const updates: Partial<Novel> = {};
          if (resolvedTitle && resolvedTitle !== novel.title)
            updates.title = resolvedTitle;
          if (resolvedAuthor && resolvedAuthor !== novel.author)
            updates.author = resolvedAuthor;
          if (resolvedCover && resolvedCover !== novel.coverUrl)
            updates.coverUrl = resolvedCover;
          if (resolvedSummary !== novel.summary)
            updates.summary = resolvedSummary;
          if (resolvedStatus && resolvedStatus !== novel.status) {
            updates.status = resolvedStatus;
          }
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
          (instance as any).parseNovelAndChapters ||
          (instance as any).parseNovel;
        if (typeof parseNovel !== "function") {
          throw new Error("This source does not support novel details.");
        }

        const data = await parseNovel(novel.pluginNovelPath);
        const normalizedDetail = normalizePluginDetailForCache(data);
        setRemoteDetail(normalizedDetail);

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

        const totalFromDetail = normalizedDetail?.totalChapters;
        const hasMoreFromTotal =
          totalFromDetail != null
            ? chaptersMapped.length < totalFromDetail
            : false;
        const canPage =
          typeof (instance as any).fetchChaptersPage === "function";
        setChaptersHasMore(canPage && hasMoreFromTotal);

        const cacheEntry: CachedPluginNovelDetail = {
          signature,
          cachedAt: Date.now(),
          detail: normalizedDetail,
          chapters: chaptersMapped,
          chaptersPage: 1,
          chaptersHasMore: canPage && hasMoreFromTotal,
        };

        NovelDetailCache.set(stableKey, cacheEntry);

        const statusRaw = String(normalizedDetail?.status || "").toLowerCase();
        const nextStatus: Novel["status"] = normalizedDetail?.status
          ? statusRaw.includes("complete") ||
              statusRaw.includes("end") ||
              statusRaw.includes("finished")
            ? "completed"
            : "ongoing"
          : novel.status;

        updateNovel(novel.id, {
          title: String(normalizedDetail?.name || novel.title),
          author: String(normalizedDetail?.author || novel.author || "Unknown"),
          coverUrl: String(normalizedDetail?.cover || novel.coverUrl),
          status: nextStatus,
          summary: String(normalizedDetail?.summary || novel.summary || ""),
          genres: Array.isArray(normalizedDetail?.genres)
            ? normalizedDetail.genres
            : novel.genres,
          totalChapters:
            totalFromDetail != null
              ? totalFromDetail
              : chaptersMapped.length || novel.totalChapters,
          pluginCache: cacheEntry,
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
    novel?.status,
    novel?.genres,
    novel?.summary,
    novel?.title,
    novel?.totalChapters,
    novel?.pluginCache,
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
    remoteDetail?.cover ||
    novel?.coverUrl ||
    "https://via.placeholder.com/300x450";
  const displaySummary = remoteDetail?.summary || novel?.summary || "";
  const displayGenres: string[] = useMemo(() => {
    if (Array.isArray(remoteDetail?.genres)) return remoteDetail.genres;
    return novel?.genres || [];
  }, [remoteDetail?.genres, novel?.genres]);
  const displayStatus: Novel["status"] = useMemo(() => {
    const raw = String(
      remoteDetail?.status || novel?.status || "",
    ).toLowerCase();
    if (
      raw.includes("complete") ||
      raw.includes("end") ||
      raw.includes("finished")
    )
      return "completed";
    if (raw.includes("ongoing")) return "ongoing";
    return (novel?.status as any) || "ongoing";
  }, [remoteDetail?.status, novel?.status]);

  const chaptersTotal = remoteChapters.length;
  const progressTotal = novel?.totalChapters
    ? Math.max(0, novel.totalChapters)
    : chaptersTotal;

  const chapterListOrder = useMemo(() => {
    return detectChapterListOrder(remoteChapters);
  }, [remoteChapters]);

  const baseReadCount = useMemo(() => {
    if (!novel) return 0;
    return Math.max(0, Math.min(progressTotal, Math.floor(novel.lastReadChapter || 0)));
  }, [novel, progressTotal]);

  const effectiveReadCount = useMemo(() => {
    if (!novel) return 0;
    return computeTotalEffectiveReadCount({
      total: progressTotal,
      baseReadCount,
      order: chapterListOrder,
      chapters: remoteChapters,
      readOverrides: novel.chapterReadOverrides,
    });
  }, [
    baseReadCount,
    chapterListOrder,
    novel,
    progressTotal,
    remoteChapters,
  ]);

  const progressPercent = progressTotal > 0 ? (effectiveReadCount / progressTotal) * 100 : 0;

  const readStatusByPath = useMemo(() => {
    const map = new Map<string, boolean>();
    if (!novel) return map;
    remoteChapters.forEach((c, index) => {
      const isRead = getEffectiveReadForChapter({
        chapterPath: c.path,
        index,
        total: progressTotal,
        baseReadCount,
        order: chapterListOrder,
        readOverrides: novel.chapterReadOverrides,
      });
      map.set(c.path, isRead);
    });
    return map;
  }, [
    baseReadCount,
    chapterListOrder,
    novel,
    progressTotal,
    remoteChapters,
  ]);

  const downloadTaskByPath = useMemo(() => {
    const map = new Map<string, { id: string; status: string }>();
    if (!novel?.pluginId) return map;
    for (const task of downloadTasks) {
      if (task.pluginId !== novel.pluginId) continue;
      if (task.novelId !== novel.id) continue;
      if (
        task.status === "pending" ||
        task.status === "downloading" ||
        task.status === "error"
      ) {
        map.set(task.chapterPath, { id: task.id, status: task.status });
      }
    }
    return map;
  }, [downloadTasks, novel?.id, novel?.pluginId]);

  const handlePluginChapterPress = useCallback(
    (chapter: PluginChapterItem) => {
      if (!novel?.pluginId) return;
      
      // Apply reader settings when opening chapter
      const readerSettings = {
        keepScreenOn: settings.reader.general.keepScreenOn,
        volumeButtonsScroll: settings.reader.general.volumeButtonsScroll,
        swipeToNavigate: settings.reader.general.swipeToNavigate,
        tapToScroll: settings.reader.general.tapToScroll,
        autoScroll: settings.reader.general.autoScroll,
        fullscreen: settings.reader.display.fullscreen,
        showProgressPercentage: settings.reader.display.showProgressPercentage,
        theme: settings.reader.theme,
      };
      
      console.log("📖 Opening chapter with reader settings:", {
        chapter: chapter.name,
        settings: Object.keys(readerSettings).filter(key => readerSettings[key as keyof typeof readerSettings])
      });
      
      (navigation as any).navigate("ChapterReader", {
        pluginId: novel.pluginId,
        novelId: novel.id,
        novelTitle: novel.title,
        chapterPath: chapter.path,
        chapterTitle: chapter.name,
        readerSettings,
      });
    },
    [navigation, novel, settings.reader],
  );

  const enqueueChapterDownload = useCallback(
    (chapter: PluginChapterItem) => {
      if (!novel?.pluginId) return;
      enqueue({
        pluginId: novel.pluginId,
        pluginName: linkedPlugin?.name || novel.source || novel.pluginId,
        novelId: novel.id,
        novelTitle: novel.title,
        chapterPath: chapter.path,
        chapterTitle: chapter.name,
      });
    },
    [
      enqueue,
      linkedPlugin?.name,
      novel?.id,
      novel?.pluginId,
      novel?.source,
      novel?.title,
    ],
  );

  const enqueueManyChapterDownloads = useCallback(
    (chapters: PluginChapterItem[]) => {
      if (!novel?.pluginId) return;
      if (!Array.isArray(chapters) || chapters.length === 0) return;
      const pluginName = linkedPlugin?.name || novel.source || novel.pluginId;
      enqueue(
        chapters.map((c) => ({
          pluginId: novel.pluginId as string,
          pluginName,
          novelId: novel.id,
          novelTitle: novel.title,
          chapterPath: c.path,
          chapterTitle: c.name,
        })),
      );
    },
    [enqueue, linkedPlugin?.name, novel?.id, novel?.pluginId, novel?.source, novel?.title],
  );

  const handleDownloadUnread = useCallback(
    (limit?: number) => {
      if (!novel?.pluginId) return;
      if (remoteChapters.length === 0) return;
      const unread = remoteChapters.filter((c, index) => {
        const isRead = getEffectiveReadForChapter({
          chapterPath: c.path,
          index,
          total: progressTotal,
          baseReadCount,
          order: chapterListOrder,
          readOverrides: novel.chapterReadOverrides,
        });
        return !isRead;
      });
      enqueueManyChapterDownloads(typeof limit === "number" ? unread.slice(0, limit) : unread);
    },
    [
      baseReadCount,
      chapterListOrder,
      enqueueManyChapterDownloads,
      novel,
      progressTotal,
      remoteChapters,
    ],
  );

  const handleDownloadNext = useCallback(
    (limit: number) => {
      if (!novel?.pluginId) return;
      if (remoteChapters.length === 0) return;
      
      // Find next undownloaded chapters
      const undownloaded = remoteChapters.filter((c) => {
        const isDownloaded = Boolean(novel?.chapterDownloaded?.[c.path]);
        return !isDownloaded;
      });
      
      // Take only the specified number of next undownloaded chapters
      const nextToDownload = undownloaded.slice(0, limit);
      
      if (nextToDownload.length === 0) {
        Alert.alert("No New Chapters", "All chapters are already downloaded.");
        return;
      }
      
      console.log(`📚 Downloading next ${limit} chapters (${nextToDownload.length} undownloaded found)`);
      enqueueManyChapterDownloads(nextToDownload);
      
      // Auto-download setting: Ask if user wants to enable auto-download for this novel
      if (settings.autoDownload.downloadNewChapters && !novel.autoDownload) {
        Alert.alert(
          "Auto-Download",
          "Enable auto-download for new chapters of this novel?",
          [
            { text: "Not Now", style: "cancel" },
            { 
              text: "Enable", 
              onPress: () => {
                updateNovel(novel.id, { autoDownload: true });
                console.log("✅ Auto-download enabled for novel:", novel.title);
              }
            }
          ]
        );
      }
    },
    [enqueueManyChapterDownloads, remoteChapters, settings.autoDownload.downloadNewChapters, novel, updateNovel],
  );

  const handleCustomDownload = useCallback(() => {
    if (!novel?.pluginId) return;
    if (remoteChapters.length === 0) return;
    
    // Find undownloaded chapters
    const undownloaded = remoteChapters.filter((c) => {
      const isDownloaded = Boolean(novel?.chapterDownloaded?.[c.path]);
      return !isDownloaded;
    });
    
    if (undownloaded.length === 0) {
      Alert.alert("No New Chapters", "All chapters are already downloaded.");
      return;
    }
    
    Alert.prompt(
      "Custom Download",
      `How many chapters would you like to download? (${undownloaded.length} undownloaded available)`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Download",
          onPress: (count?: string) => {
            const num = parseInt(count || "0");
            if (num > 0 && num <= undownloaded.length) {
              console.log(`📚 Custom downloading ${num} chapters`);
              enqueueManyChapterDownloads(undownloaded.slice(0, num));
            } else if (num > undownloaded.length) {
              Alert.alert("Too Many", `Only ${undownloaded.length} chapters are available.`);
            } else {
              Alert.alert("Invalid Number", "Please enter a valid number.");
            }
          },
        },
      ],
      "plain-text",
      Math.min(10, undownloaded.length).toString(),
    );
  }, [enqueueManyChapterDownloads, novel?.chapterDownloaded, novel?.pluginId, remoteChapters]);

  const handleDownloadAll = useCallback(() => {
    if (!novel?.pluginId) return;
    enqueueManyChapterDownloads(remoteChapters);
  }, [enqueueManyChapterDownloads, novel?.pluginId, remoteChapters]);

  const handleDeleteAllDownloads = useCallback(() => {
    if (!novel?.pluginId) return;
    const current = novelRef.current;
    const downloaded = current?.chapterDownloaded || {};
    const paths = Object.keys(downloaded);
    if (paths.length === 0) return;

    Alert.alert(
      "Delete downloads",
      `Delete ${paths.length} downloaded chapter${paths.length === 1 ? "" : "s"}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void (async () => {
              cancelNovelTasks(novel.id);
              await Promise.all(
                paths.map((p) =>
                  ChapterDownloads.deleteChapterHtml(
                    novel.pluginId as string,
                    novel.id,
                    p,
                    settings.general.downloadLocation,
                  ),
                ),
              );
              updateNovel(novel.id, {
                chapterDownloaded: undefined,
                isDownloaded: false,
              });
            })();
          },
        },
      ],
    );
  }, [cancelNovelTasks, novel, settings.general.downloadLocation, updateNovel]);

  const downloadOptions = [
    { id: "next", label: "Next chapter", onPress: () => handleDownloadNext(1) },
    { id: "next5", label: "Next 5 chapters", onPress: () => handleDownloadNext(5) },
    { id: "next10", label: "Next 10 chapters", onPress: () => handleDownloadNext(10) },
    { id: "custom", label: "Custom", onPress: handleCustomDownload },
    { id: "unread", label: "Unread", onPress: () => handleDownloadUnread() },
    { id: "all", label: "All", onPress: handleDownloadAll },
    {
      id: "delete",
      label: "Delete downloads",
      isDestructive: true,
      onPress: handleDeleteAllDownloads,
    },
  ];

  const handleShare = () => {};
  const handleEpubExport = () => {};

  const handleWebView = useCallback(() => {
    const url =
      remoteDetail?.url ||
      (novel?.pluginId
        ? settings.extensions.installedPlugins?.[novel.pluginId]?.site
        : null) ||
      `https://example.com/novel/${novel?.id || ""}`;
    (navigation as any).navigate("WebView", { url });
  }, [navigation, novel?.id, novel?.pluginId, remoteDetail?.url, settings.extensions.installedPlugins]);

  const clearChapterSelection = useCallback(() => {
    setIsChapterSelectionMenuVisible(false);
    setSelectedChapterPaths(new Set());
  }, []);

  const toggleChapterSelected = useCallback((path: string) => {
    setSelectedChapterPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const selectAllChapters = useCallback(() => {
    if (remoteChapters.length === 0) return;
    setSelectedChapterPaths(new Set(remoteChapters.map((c) => c.path)));
  }, [remoteChapters]);

  const invertChapterSelection = useCallback(() => {
    if (remoteChapters.length === 0) return;
    setSelectedChapterPaths((prev) => {
      const next = new Set<string>();
      for (const c of remoteChapters) {
        if (!prev.has(c.path)) next.add(c.path);
      }
      return next;
    });
  }, [remoteChapters]);

  const markSelectedChaptersRead = useCallback(() => {
    if (!novel) return;
    if (selectedChapterPaths.size === 0) return;

    if (remoteChapters.length > 0 && selectedChapterPaths.size === remoteChapters.length) {
      updateNovel(novel.id, {
        unreadChapters: 0,
        lastReadChapter: progressTotal,
        lastReadDate: new Date(),
        chapterReadOverrides: undefined,
      });
      clearChapterSelection();
      return;
    }

    const nextOverrides = updateReadOverridesForSelection({
      total: progressTotal,
      baseReadCount,
      order: chapterListOrder,
      chapters: remoteChapters,
      selectedPaths: selectedChapterPaths,
      readOverrides: novel.chapterReadOverrides,
      markAs: "read",
    });

    const nextReadCount = computeTotalEffectiveReadCount({
      total: progressTotal,
      baseReadCount,
      order: chapterListOrder,
      chapters: remoteChapters,
      readOverrides: nextOverrides,
    });

    updateNovel(novel.id, {
      unreadChapters: Math.max(0, progressTotal - nextReadCount),
      lastReadDate: new Date(),
      chapterReadOverrides: nextOverrides,
    });
    clearChapterSelection();
  }, [
    chapterListOrder,
    baseReadCount,
    progressTotal,
    clearChapterSelection,
    novel,
    remoteChapters,
    selectedChapterPaths,
    updateNovel,
  ]);

  const markSelectedChaptersUnread = useCallback(() => {
    if (!novel) return;
    if (selectedChapterPaths.size === 0) return;

    if (remoteChapters.length > 0 && selectedChapterPaths.size === remoteChapters.length) {
      updateNovel(novel.id, {
        unreadChapters: progressTotal,
        lastReadChapter: 0,
        lastReadDate: undefined,
        chapterReadOverrides: undefined,
      });
      clearChapterSelection();
      return;
    }

    const nextOverrides = updateReadOverridesForSelection({
      total: progressTotal,
      baseReadCount,
      order: chapterListOrder,
      chapters: remoteChapters,
      selectedPaths: selectedChapterPaths,
      readOverrides: novel.chapterReadOverrides,
      markAs: "unread",
    });

    const nextReadCount = computeTotalEffectiveReadCount({
      total: progressTotal,
      baseReadCount,
      order: chapterListOrder,
      chapters: remoteChapters,
      readOverrides: nextOverrides,
    });

    updateNovel(novel.id, {
      unreadChapters: Math.max(0, progressTotal - nextReadCount),
      lastReadDate: nextReadCount === 0 ? undefined : novel.lastReadDate,
      chapterReadOverrides: nextOverrides,
    });
    clearChapterSelection();
  }, [
    chapterListOrder,
    baseReadCount,
    progressTotal,
    clearChapterSelection,
    novel,
    remoteChapters,
    selectedChapterPaths,
    updateNovel,
  ]);

  const deleteSelectedChapterDownloads = useCallback(() => {
    if (!novel?.pluginId) return;
    const count = selectedChapterPaths.size;
    if (count === 0) return;

    Alert.alert(
      "Delete downloads",
      `Delete ${count} downloaded chapter${count === 1 ? "" : "s"}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void (async () => {
              const pluginId = novel.pluginId as string;
              const novelId = novel.id;
              const paths = Array.from(selectedChapterPaths);

              for (const task of downloadTasks) {
                if (task.pluginId !== pluginId) continue;
                if (task.novelId !== novelId) continue;
                if (!selectedChapterPaths.has(task.chapterPath)) continue;
                if (task.status === "pending" || task.status === "downloading") {
                  cancelTask(task.id);
                }
              }

              await Promise.all(
                paths.map((p) =>
                  ChapterDownloads.deleteChapterHtml(
                    pluginId,
                    novelId,
                    p,
                    settings.general.downloadLocation,
                  ),
                ),
              );

              const current = novelRef.current;
              const base = current?.chapterDownloaded || {};
              const next = { ...base };
              for (const p of paths) delete next[p];
              const keys = Object.keys(next);

              updateNovel(novelId, {
                chapterDownloaded: keys.length ? next : undefined,
                isDownloaded: keys.length > 0,
              });

              clearChapterSelection();
            })();
          },
        },
      ],
    );
  }, [
    cancelTask,
    clearChapterSelection,
    downloadTasks,
    novel,
    selectedChapterPaths,
    settings.general.downloadLocation,
    updateNovel,
  ]);

  const chapterSelectionMenuItems = useMemo(
    () => [
      { id: "selectAll", label: "Select all", onPress: selectAllChapters },
      { id: "invert", label: "Select inverse", onPress: invertChapterSelection },
      { id: "read", label: "Mark as read", onPress: markSelectedChaptersRead },
      { id: "unread", label: "Mark as unread", onPress: markSelectedChaptersUnread },
      {
        id: "delete",
        label: "Delete",
        isDestructive: true,
        onPress: deleteSelectedChapterDownloads,
      },
    ],
    [
      deleteSelectedChapterDownloads,
      invertChapterSelection,
      markSelectedChaptersRead,
      markSelectedChaptersUnread,
      selectAllChapters,
    ],
  );

  const handleMarkRead = () => {
    if (!novel) return;
    const total = novel.totalChapters > 0 ? novel.totalChapters : chaptersTotal;
    updateNovel(novel.id, {
      unreadChapters: 0,
      lastReadChapter: total,
      lastReadDate: new Date(),
      chapterReadOverrides: undefined,
    });
  };

  const handleMarkUnread = () => {
    if (!novel) return;
    const total = novel.totalChapters > 0 ? novel.totalChapters : chaptersTotal;
    updateNovel(novel.id, {
      unreadChapters: total,
      lastReadChapter: 0,
      lastReadDate: undefined,
      chapterReadOverrides: undefined,
    });
  };

  const moreOptions = [
    { id: "openWeb", label: "Open website", onPress: handleWebView },
    { id: "markRead", label: "Mark as read", onPress: handleMarkRead },
    { id: "markUnread", label: "Mark as unread", onPress: handleMarkUnread },
    { id: "editInfo", label: "Edit info", onPress: () => {} },
    { id: "editCover", label: "Edit cover", onPress: () => {} },
  ];

  const handleLibraryToggle = useCallback(() => {
    if (!novel) return;
    if (isInLibrary) {
      removeNovel(novel.id);
      if ((navigation as any).canGoBack?.()) {
        (navigation as any).goBack();
      } else {
        (navigation as any).navigate("Main", { screen: "Library" });
      }
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
  }, [novel, isInLibrary, removeNovel, navigation, categoryChoices, updateNovel]);

  const handleGenrePress = useCallback((genre: string) => {
    (navigation as any).navigate("SourceDetail", { genre });
  }, [navigation]);

  const loadMoreChapters = async () => {
    if (!novel?.pluginId || !novel?.pluginNovelPath) return;
    if (!linkedPlugin || !linkedPlugin.enabled) return;
    if (!chaptersHasMore || isRemoteLoading || isChaptersLoadingMore) return;

    try {
      setIsChaptersLoadingMore(true);
      const instance = await PluginRuntimeService.loadLnReaderPlugin(
        linkedPlugin,
        {
          userAgent: settings.advanced.userAgent,
        },
      );
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

      const seen = new Set(remoteChapters.map((c) => c.path));
      const next = [...remoteChapters];
      for (const c of mapped) {
        if (!seen.has(c.path)) next.push(c);
      }

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
        NovelDetailCache.get(stableKey)?.detail ??
        novel.pluginCache?.detail ??
        null;

      const cacheEntry: CachedPluginNovelDetail = {
        signature,
        cachedAt: Date.now(),
        detail: cacheDetail,
        chapters: next,
        chaptersPage: appliedPage,
        chaptersHasMore: nextHasMore,
      };

      NovelDetailCache.set(stableKey, cacheEntry);
      updateNovel(novel.id, { pluginCache: cacheEntry });
    } catch {
      // ignore
    } finally {
      setIsChaptersLoadingMore(false);
    }
  };

  const handleProgressPress = useCallback(() => {
    if (!novel?.pluginId) return;
    if (remoteChapters.length === 0) return;

    const total =
      novel.totalChapters > 0 ? novel.totalChapters : remoteChapters.length;
    const lastRead = Math.max(
      0,
      Math.min(total, Math.floor(novel.lastReadChapter || 0)),
    );

    // If no chapters have been read, start from the first chapter
    if (lastRead === 0) {
      const firstChapter = remoteChapters[0];
      if (firstChapter) handlePluginChapterPress(firstChapter);
      return;
    }

    // If all chapters are read, go to the last chapter
    const unread = Math.max(0, Math.min(total, Math.floor(novel.unreadChapters || 0)));
    if (unread === 0) {
      const lastChapter = remoteChapters[remoteChapters.length - 1];
      if (lastChapter) handlePluginChapterPress(lastChapter);
      return;
    }

    // Resume from the last read chapter (convert 1-based to 0-based index)
    const targetIndex = Math.min(remoteChapters.length - 1, Math.max(0, lastRead - 1));
    const target = remoteChapters[targetIndex];
    if (target) handlePluginChapterPress(target);
  }, [handlePluginChapterPress, novel?.pluginId, novel?.lastReadChapter, novel?.totalChapters, novel?.unreadChapters, remoteChapters]);

  const handleHeaderBackPress = useCallback(() => {
    if (isChapterSelectionMode) {
      clearChapterSelection();
      return;
    }
    if ((navigation as any).canGoBack?.()) {
      (navigation as any).goBack();
    } else {
      (navigation as any).navigate("Main", { screen: "Library" });
    }
  }, [clearChapterSelection, isChapterSelectionMode, navigation]);

  const renderChapterItem = useCallback(
    ({ item, index }: { item: PluginChapterItem; index: number }) => {
      const c = item;
      const selected = selectedChapterPaths.has(c.path);
      const isRead = readStatusByPath.get(c.path) ?? false;
      const downloadInfo = downloadTaskByPath.get(c.path);
      const isDownloaded = Boolean(novel?.chapterDownloaded?.[c.path]);

      return (
        <ChapterItem
          item={c}
          index={index}
          selected={selected}
          isRead={isRead}
          downloadInfo={downloadInfo}
          isDownloaded={isDownloaded}
          isChapterSelectionMode={isChapterSelectionMode}
          theme={theme}
          toggleChapterSelected={toggleChapterSelected}
          handlePluginChapterPress={handlePluginChapterPress}
          enqueueChapterDownload={enqueueChapterDownload}
        />
      );
    },
    [
      downloadTaskByPath,
      enqueueChapterDownload,
      isChapterSelectionMode,
      novel?.chapterDownloaded,
      readStatusByPath,
      selectedChapterPaths,
      theme,
      toggleChapterSelected,
      handlePluginChapterPress,
    ],
  );

  const listHeader = useMemo(
    () => (
      <>
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
            <Text
              style={[
                styles.centerText,
                { color: theme.colors.textSecondary },
              ]}
            >
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
            <Text
              style={[styles.title, { color: theme.colors.text }]}
              numberOfLines={3}
            >
              {displayTitle}
            </Text>
            <Text
              style={[styles.author, { color: theme.colors.textSecondary }]}
              numberOfLines={1}
            >
              {displayAuthor}
            </Text>
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor:
                      displayStatus === "completed"
                        ? theme.colors.success
                        : theme.colors.warning,
                  },
                ]}
              >
                <Text style={styles.statusText}>{displayStatus}</Text>
              </View>
              <Text
                style={[styles.source, { color: theme.colors.textSecondary }]}
                numberOfLines={1}
              >
                {novel?.source}
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
            <Text
              style={[styles.actionButtonText, { color: theme.colors.text }]}
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
            {displaySummary || "(No summary)"}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Genres
          </Text>
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
                <Text
                  style={[styles.genreText, { color: theme.colors.primary }]}
                >
                  {genre}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={styles.progressSection}
          onPress={handleProgressPress}
        >
          <View style={styles.progressInfo}>
            <Text style={[styles.progressText, { color: theme.colors.text }]}>
              Progress
            </Text>
            <Text
              style={[styles.progressText, { color: theme.colors.primary }]}
            >
              {effectiveReadCount} / {progressTotal}
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
            style={[
              styles.chapterCount,
              { color: theme.colors.textSecondary },
            ]}
          >
            {progressTotal} chapters
          </Text>
        </TouchableOpacity>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Chapters
          </Text>
          {(!novel?.pluginId || remoteChapters.length === 0) && (
            <Text
              style={[styles.summary, { color: theme.colors.textSecondary }]}
            >
              Chapters are not available for this item yet.
            </Text>
          )}
        </View>
      </>
    ),
    [
      coverHeight,
      coverWidth,
      displayAuthor,
      displayCover,
      displayGenres,
      displayStatus,
      displaySummary,
      displayTitle,
      effectiveReadCount,
      handleGenrePress,
      handleLibraryToggle,
      handleProgressPress,
      handleWebView,
      isInLibrary,
      isRemoteLoading,
      novel?.pluginId,
      novel?.source,
      progressPercent,
      progressTotal,
      remoteChapters.length,
      remoteDetail,
      remoteError,
      theme.colors.border,
      theme.colors.error,
      theme.colors.primary,
      theme.colors.success,
      theme.colors.surface,
      theme.colors.text,
      theme.colors.textSecondary,
      theme.colors.warning,
    ],
  );

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Header
        title={isChapterSelectionMode ? `${selectedChapterPaths.size} selected` : ""}
        onBackPress={handleHeaderBackPress}
        rightButtons={
          isChapterSelectionMode ? (
            <TouchableOpacity
              onPress={() => setIsChapterSelectionMenuVisible(true)}
              style={styles.iconButton}
            >
              <Ionicons name="ellipsis-vertical" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                onPress={handleEpubExport}
                style={styles.iconButton}
              >
                <Ionicons
                  name="document-text"
                  size={24}
                  color={theme.colors.text}
                />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleShare} style={styles.iconButton}>
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
                  name={novel?.isDownloaded ? "download" : "download-outline"}
                  size={24}
                  color={
                    novel?.isDownloaded ? theme.colors.success : theme.colors.text
                  }
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
          )
        }
      />

      {!novel ? (
        <View style={styles.loadingCenter}>
          <Text style={[styles.errorText, { color: theme.colors.error }]}>
            Novel not found in library.
          </Text>
        </View>
      ) : (
        <FlatList
          data={novel.pluginId ? remoteChapters : []}
          keyExtractor={(item) => item.path}
          renderItem={renderChapterItem}
          ListHeaderComponent={listHeader}
          ListFooterComponent={
            novel.pluginId && chaptersHasMore ? (
              <View style={styles.section}>
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
            ) : null
          }
          contentContainerStyle={styles.listContent}
          initialNumToRender={30}
          maxToRenderPerBatch={40}
          windowSize={10}
          removeClippedSubviews
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
            />
          }
        />
      )}

      <PopupMenu
        visible={isDownloadMenuVisible}
        onClose={() => setIsDownloadMenuVisible(false)}
        items={downloadOptions}
      />

      <PopupMenu
        visible={isChapterSelectionMenuVisible}
        onClose={() => setIsChapterSelectionMenuVisible(false)}
        items={chapterSelectionMenuItems}
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
                    style={[
                      styles.categoryRow,
                      { borderColor: theme.colors.divider },
                    ]}
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
                <Text
                  style={[styles.modalButtonText, { color: theme.colors.text }]}
                >
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
                      color: pendingCategoryId
                        ? "#FFF"
                        : theme.colors.textSecondary,
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
    paddingHorizontal: 2,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  chapterLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    paddingRight: 10,
  },
  chapterRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  chapterIconBtn: {
    padding: 4,
    borderRadius: 8,
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
  listContent: {
    flexGrow: 1,
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
