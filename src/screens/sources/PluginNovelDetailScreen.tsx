import { Ionicons } from "@expo/vector-icons";
import type { RouteProp } from "@react-navigation/native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { FlashList, ListRenderItem } from "@shopify/flash-list";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    Platform,
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
import type { RootStackParamList } from "../../navigation/types";
import { ChapterDownloads } from "../../services/chapterDownloads";
import {
    normalizePluginDetailForCache,
    NovelDetailCache,
} from "../../services/novelDetailCache";
import { PluginRuntimeService } from "../../services/pluginRuntime";
import type { Theme } from "../../theme";
import type { CachedPluginNovelDetail, Novel } from "../../types";
import {
    computeTotalEffectiveReadCount,
    detectChapterListOrder,
    getEffectiveReadForChapter,
    updateReadOverridesForSelection,
} from "../../utils/chapterState";
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

type ChapterRowProps = {
  chapter: ChapterItem;
  theme: Theme;
  isSelectionMode: boolean;
  selected: boolean;
  isRead: boolean;
  isInLibrary: boolean;
  isDownloaded: boolean;
  downloadStatus?: string;
  onToggleSelected: (path: string) => void;
  onOpenChapter: (chapter: ChapterItem) => void;
  onEnqueueDownload: (chapter: ChapterItem) => void;
};

const ChapterRow = React.memo(
  ({
    chapter,
    theme,
    isSelectionMode,
    selected,
    isRead,
    isInLibrary,
    isDownloaded,
    downloadStatus,
    onToggleSelected,
    onOpenChapter,
    onEnqueueDownload,
  }: ChapterRowProps) => {
    const handlePress = useCallback(() => {
      if (isSelectionMode) {
        onToggleSelected(chapter.path);
        return;
      }
      onOpenChapter(chapter);
    }, [chapter, isSelectionMode, onOpenChapter, onToggleSelected]);

    const handleLongPress = useCallback(
      () => onToggleSelected(chapter.path),
      [chapter.path, onToggleSelected],
    );

    const handleDownloadPress = useCallback(() => {
      if (isDownloaded) return;
      if (downloadStatus === "pending" || downloadStatus === "downloading") return;
      onEnqueueDownload(chapter);
    }, [chapter, downloadStatus, isDownloaded, onEnqueueDownload]);

    return (
      <TouchableOpacity
        style={[
          styles.chapterItem,
          selected && { backgroundColor: theme.colors.primary + "1A" },
          { borderBottomColor: theme.colors.divider },
        ]}
        onPress={handlePress}
        onLongPress={handleLongPress}
        delayLongPress={220}
      >
        <View style={styles.chapterLeft}>
          {isSelectionMode ? (
            <Ionicons
              name={selected ? "checkmark-circle" : "ellipse-outline"}
              size={22}
              color={selected ? theme.colors.primary : theme.colors.textSecondary}
            />
          ) : null}

          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.chapterTitle,
                { color: isRead ? theme.colors.textSecondary : theme.colors.text },
              ]}
              numberOfLines={2}
            >
              {chapter.name}
            </Text>
            {!!chapter.releaseTime && (
              <Text
                style={[styles.chapterMeta, { color: theme.colors.textSecondary }]}
                numberOfLines={1}
              >
                {chapter.releaseTime}
              </Text>
            )}
          </View>
        </View>

        {!isSelectionMode ? (
          <View style={styles.chapterRight}>
            <TouchableOpacity
              onPress={handleDownloadPress}
              style={[
                styles.chapterIconBtn,
                (!isInLibrary || isDownloaded) && { opacity: 0.65 },
              ]}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
              {isDownloaded ? (
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={theme.colors.primary}
                />
              ) : downloadStatus === "downloading" ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : downloadStatus === "pending" ? (
                <Ionicons
                  name="time-outline"
                  size={20}
                  color={theme.colors.textSecondary}
                />
              ) : downloadStatus === "error" ? (
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
  },
  (prev, next) =>
    prev.chapter === next.chapter &&
    prev.theme === next.theme &&
    prev.isSelectionMode === next.isSelectionMode &&
    prev.selected === next.selected &&
    prev.isRead === next.isRead &&
    prev.isInLibrary === next.isInLibrary &&
    prev.isDownloaded === next.isDownloaded &&
    prev.downloadStatus === next.downloadStatus &&
    prev.onToggleSelected === next.onToggleSelected &&
    prev.onOpenChapter === next.onOpenChapter &&
    prev.onEnqueueDownload === next.onEnqueueDownload,
);
ChapterRow.displayName = "ChapterRow";

export const PluginNovelDetailScreen: React.FC = () => {
  const navigation = useNavigation();
  const route =
    useRoute<RouteProp<RootStackParamList, "PluginNovelDetail">>();
  const { theme } = useTheme();
  const { settings } = useSettings();
  const { novels, addNovel, updateNovel, categories } = useLibrary();
  const { tasks: downloadTasks, enqueue, cancelTask, cancelNovelTasks } =
    useDownloadQueue();
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

  const existingNovelRef = useRef<Novel | undefined>(undefined);
  const loadTokenRef = useRef(0);
  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    existingNovelRef.current = existingNovel || undefined;
  }, [existingNovel]);

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
    () => (Array.isArray(initialCached?.chapters) ? initialCached!.chapters : []),
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false);
  const [pendingCategoryId, setPendingCategoryId] = useState<string | null>(
    null,
  );

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
    setSelectedChapterPaths((prev) => {
      if (prev.size === 0) return prev;
      const available = new Set(chapters.map((c) => c.path));
      const next = new Set([...prev].filter((id) => available.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [chapters]);

  useEffect(() => {
    const token = ++loadTokenRef.current;
    if (persistTimeoutRef.current) {
      clearTimeout(persistTimeoutRef.current);
      persistTimeoutRef.current = null;
    }

    const isStale = () => token !== loadTokenRef.current;
    const yieldToMain = () =>
      new Promise<void>((resolve) => setTimeout(resolve, 0));

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

      const hasCachedChapters =
        Array.isArray(cached?.chapters) && cached.chapters.length > 0;

      if (cached) {
        if (isStale()) return;
        setError(null);
        setRemoteDetail(cached.detail);
        setRemoteChapters(
          Array.isArray(cached.chapters) ? cached.chapters : [],
        );
        setChaptersPage(cached.chaptersPage);
        setChaptersHasMore(cached.chaptersHasMore);
        setIsLoading(false);
        if (cached.signature === fetchSignature) return;

        await yieldToMain();
        if (isStale()) return;
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

        const data = await (parseNovel as any).call(instance, novelPath);
        if (isStale()) return;
        const normalizedDetail = normalizePluginDetailForCache(data);
        setRemoteDetail(normalizedDetail);

        const totalFromDetail = normalizedDetail?.totalChapters;
        const rawChapters = Array.isArray(data?.chapters) ? data.chapters : [];
        const chaptersMapped: ChapterItem[] = [];

        const streamChapters = !hasCachedChapters;
        if (streamChapters) {
          setIsLoading(false);
          setRemoteChapters([]);
          await yieldToMain();
          if (isStale()) return;
        }

        const CHUNK_SIZE = 2000;
        for (let start = 0; start < rawChapters.length; start += CHUNK_SIZE) {
          if (isStale()) return;

          const end = Math.min(rawChapters.length, start + CHUNK_SIZE);
          const chunk: ChapterItem[] = [];
          for (let i = start; i < end; i++) {
            const c = rawChapters[i];
            if (!isChapterItem(c)) continue;
            chunk.push({
              name: c.name,
              path: c.path,
              releaseTime: (c as any)?.releaseTime ?? null,
              chapterNumber:
                typeof (c as any)?.chapterNumber === "number"
                  ? (c as any).chapterNumber
                  : undefined,
            });
          }

          if (chunk.length) {
            chaptersMapped.push(...chunk);
            if (streamChapters) {
              setRemoteChapters((prev) => prev.concat(chunk));
            }
          }

          if (end < rawChapters.length) {
            await yieldToMain();
          }
        }

        if (isStale()) return;
        if (!streamChapters) {
          setRemoteChapters(chaptersMapped);
        }

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
        if (existingNovelRef.current) {
          persistTimeoutRef.current = setTimeout(() => {
            if (token !== loadTokenRef.current) return;
            const still = existingNovelRef.current;
            if (!still) return;
            updateNovel(still.id, { pluginCache: cacheEntry });
          }, 0);
        }
      } catch (e: any) {
        if (!cached) {
          setError(e?.message || "Failed to load novel details.");
        }
      } finally {
        setIsLoading(false);
      }
    };
    void run();

    return () => {
      loadTokenRef.current += 1;
      if (persistTimeoutRef.current) {
        clearTimeout(persistTimeoutRef.current);
        persistTimeoutRef.current = null;
      }
    };
  }, [
    cacheKey,
    existingNovel?.pluginCache,
    fetchSignature,
    novelPath,
    plugin,
    settings.advanced.userAgent,
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

  // Refresh function for pull-to-refresh
  const handleRefresh = useCallback(async () => {
    if (!plugin) return;
    
    setIsRefreshing(true);
    try {
      // Clear cache to force fresh fetch
      NovelDetailCache.clear(cacheKey);
      
      // Reset loading state and trigger re-fetch
      setError(null);
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

      const data = await parseNovel(novelPath);
      const normalizedDetail = normalizePluginDetailForCache(data);
      setRemoteDetail(normalizedDetail);

      const chaptersRaw = Array.isArray(data?.chapters) ? data.chapters : [];
      const chaptersMapped = chaptersRaw
        .map((c: any) => ({
          name: String(c?.name || ""),
          path: String(c?.path || ""),
          releaseTime: c?.releaseTime ?? null,
        }))
        .filter(isChapterItem);
      setRemoteChapters(chaptersMapped);
      setChaptersPage(1);

      const totalFromDetail = normalizedDetail?.totalChapters;
      const hasMoreFromTotal =
        totalFromDetail != null
          ? chaptersMapped.length < totalFromDetail
          : false;
      const canPage = typeof (instance as any).fetchChaptersPage === "function";
      setChaptersHasMore(canPage && hasMoreFromTotal);

      const signature = NovelDetailCache.signature({
        novelId: stableNumericId,
        pluginId: plugin.id,
        novelPath,
        pluginVersion: plugin.version,
        pluginUrl: plugin.url,
        pluginLocalPath: plugin.localPath,
        userAgent: settings.advanced.userAgent,
      });

      const cacheEntry: CachedPluginNovelDetail = {
        signature,
        cachedAt: Date.now(),
        detail: normalizedDetail,
        chapters: chaptersMapped,
        chaptersPage: 1,
        chaptersHasMore: canPage && hasMoreFromTotal,
      };

      NovelDetailCache.set(cacheKey, cacheEntry);
      
      // Update existing novel if it's in library
      if (existingNovel) {
        updateNovel(existingNovel.id, { pluginCache: cacheEntry });
      }

      console.log("🔄 Plugin novel details refreshed successfully");
    } catch (e: any) {
      console.error("❌ Failed to refresh plugin novel details:", e);
      setError(e?.message || "Failed to refresh novel details.");
    } finally {
      setIsRefreshing(false);
    }
  }, [plugin, cacheKey, novelPath, settings.advanced.userAgent, existingNovel, updateNovel, stableNumericId]);

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

  const buildLibraryNovel = useCallback(
    (nextInLibrary: boolean): Novel => {
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
    },
    [
      author,
      cacheKey,
      chapters.length,
      cover,
      existingNovel,
      genres,
      normalizedStatus,
      novelPath,
      plugin?.name,
      pluginId,
      remoteDetail?.totalChapters,
      stableNumericId,
      summary,
      title,
    ],
  );

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

  const upsertLibraryNovel = useCallback(
    (nextInLibrary: boolean, categoryId?: string) => {
      const base = buildLibraryNovel(nextInLibrary);
      const withCategory = categoryId ? { ...base, categoryId } : base;

      if (!existingNovel) {
        addNovel({ ...withCategory, isInLibrary: true });
        return;
      }
      updateNovel(stableNumericId, withCategory);
    },
    [addNovel, buildLibraryNovel, existingNovel, stableNumericId, updateNovel],
  );

  const handleLibraryToggle = useCallback(() => {
    setIsInLibrary((prev) => {
      const next = !prev;
      upsertLibraryNovel(next);
      return next;
    });
  }, [upsertLibraryNovel]);

  const handleAddToLibrary = useCallback(() => {
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
  }, [categoryChoices, isInLibrary, upsertLibraryNovel]);

  const handleWebView = useCallback(() => {
    const url = remoteDetail?.url || plugin?.site || plugin?.url || "";
    if (url) navigation.navigate("WebView", { url });
  }, [navigation, plugin?.site, plugin?.url, remoteDetail?.url]);

  const chaptersTotal = chapters.length;
  const progressTotal =
    (existingNovel?.totalChapters && existingNovel.totalChapters > 0
      ? existingNovel.totalChapters
      : chaptersTotal) || chaptersTotal;

  const chapterListOrder = useMemo(() => detectChapterListOrder(chapters), [chapters]);

  const baseReadCount = useMemo(() => {
    if (!existingNovel) return 0;
    return Math.max(0, Math.min(progressTotal, Math.floor(existingNovel.lastReadChapter || 0)));
  }, [existingNovel, progressTotal]);

  const effectiveReadCount = useMemo(() => {
    if (!existingNovel) return 0;
    return computeTotalEffectiveReadCount({
      total: progressTotal,
      baseReadCount,
      order: chapterListOrder,
      chapters,
      readOverrides: existingNovel.chapterReadOverrides,
    });
  }, [
    baseReadCount,
    chapterListOrder,
    chapters,
    existingNovel,
    progressTotal,
  ]);

  const downloadTaskByPath = useMemo(() => {
    const map = new Map<string, { id: string; status: string }>();
    for (const task of downloadTasks) {
      if (task.pluginId !== pluginId) continue;
      if (task.novelId !== stableNumericId) continue;
      if (
        task.status === "pending" ||
        task.status === "downloading" ||
        task.status === "error"
      ) {
        map.set(task.chapterPath, { id: task.id, status: task.status });
      }
    }
    return map;
  }, [downloadTasks, pluginId, stableNumericId]);

  const enqueueChapterDownload = useCallback(
    (chapter: ChapterItem) => {
      if (!chapter?.path) return;
      if (!existingNovel) {
        Alert.alert("Not in library", "Add this novel to your library to download chapters.");
        return;
      }
      enqueue({
        pluginId,
        pluginName: plugin?.name || pluginId,
        novelId: existingNovel.id,
        novelTitle: existingNovel.title,
        chapterPath: chapter.path,
        chapterTitle: chapter.name,
      });
    },
    [existingNovel, enqueue, plugin?.name, pluginId],
  );

  const enqueueManyChapterDownloads = useCallback(
    (items: ChapterItem[]) => {
      if (!existingNovel) {
        Alert.alert("Not in library", "Add this novel to your library to download chapters.");
        return;
      }
      if (!Array.isArray(items) || items.length === 0) return;
      enqueue(
        items.map((c) => ({
          pluginId,
          pluginName: plugin?.name || pluginId,
          novelId: existingNovel.id,
          novelTitle: existingNovel.title,
          chapterPath: c.path,
          chapterTitle: c.name,
        })),
      );
    },
    [enqueue, existingNovel, plugin?.name, pluginId],
  );

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
    if (chapters.length === 0) return;
    setSelectedChapterPaths(new Set(chapters.map((c) => c.path)));
  }, [chapters]);

  const invertChapterSelection = useCallback(() => {
    if (chapters.length === 0) return;
    setSelectedChapterPaths((prev) => {
      const next = new Set<string>();
      for (const c of chapters) {
        if (!prev.has(c.path)) next.add(c.path);
      }
      return next;
    });
  }, [chapters]);

  const markSelectedChaptersRead = useCallback(() => {
    if (!existingNovel) {
      Alert.alert("Not in library", "Add this novel to your library to track progress.");
      return;
    }
    if (selectedChapterPaths.size === 0) return;

    if (chapters.length > 0 && selectedChapterPaths.size === chapters.length) {
      updateNovel(existingNovel.id, {
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
      chapters,
      selectedPaths: selectedChapterPaths,
      readOverrides: existingNovel.chapterReadOverrides,
      markAs: "read",
    });

    const nextReadCount = computeTotalEffectiveReadCount({
      total: progressTotal,
      baseReadCount,
      order: chapterListOrder,
      chapters,
      readOverrides: nextOverrides,
    });

    updateNovel(existingNovel.id, {
      unreadChapters: Math.max(0, progressTotal - nextReadCount),
      lastReadDate: new Date(),
      chapterReadOverrides: nextOverrides,
    });

    clearChapterSelection();
  }, [
    baseReadCount,
    chapterListOrder,
    chapters,
    clearChapterSelection,
    existingNovel,
    progressTotal,
    selectedChapterPaths,
    updateNovel,
  ]);

  const markSelectedChaptersUnread = useCallback(() => {
    if (!existingNovel) {
      Alert.alert("Not in library", "Add this novel to your library to track progress.");
      return;
    }
    if (selectedChapterPaths.size === 0) return;

    if (chapters.length > 0 && selectedChapterPaths.size === chapters.length) {
      updateNovel(existingNovel.id, {
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
      chapters,
      selectedPaths: selectedChapterPaths,
      readOverrides: existingNovel.chapterReadOverrides,
      markAs: "unread",
    });

    const nextReadCount = computeTotalEffectiveReadCount({
      total: progressTotal,
      baseReadCount,
      order: chapterListOrder,
      chapters,
      readOverrides: nextOverrides,
    });

    updateNovel(existingNovel.id, {
      unreadChapters: Math.max(0, progressTotal - nextReadCount),
      lastReadDate: nextReadCount === 0 ? undefined : existingNovel.lastReadDate,
      chapterReadOverrides: nextOverrides,
    });

    clearChapterSelection();
  }, [
    baseReadCount,
    chapterListOrder,
    chapters,
    clearChapterSelection,
    existingNovel,
    progressTotal,
    selectedChapterPaths,
    updateNovel,
  ]);

  const deleteSelectedChapterDownloads = useCallback(() => {
    if (!existingNovel) {
      Alert.alert("Not in library", "Add this novel to your library to manage downloads.");
      return;
    }
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
              const novelId = existingNovel.id;
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

              const current = existingNovelRef.current;
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
    existingNovel,
    pluginId,
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

  const openChapter = useCallback(
    (chapter: ChapterItem) => {
      if (existingNovel) {
        navigation.navigate("Reader", {
          novelId: stableNumericId,
          chapterId: chapter.path,
        });
        return;
      }

      navigation.navigate("PluginReader", {
        pluginId,
        novelId: stableNumericId,
        novelPath,
        chapterPath: chapter.path,
        chapterTitle: chapter.name,
      });
    },
    [existingNovel, navigation, pluginId, novelPath, stableNumericId],
  );

  const handleProgressPress = useCallback(() => {
    const list = chapters;
    if (list.length === 0) return;

    const total =
      (existingNovel?.totalChapters && existingNovel.totalChapters > 0
        ? existingNovel.totalChapters
        : list.length) || list.length;
    const lastRead = Math.max(
      0,
      Math.min(total, Math.floor(existingNovel?.lastReadChapter || 0)),
    );
    const unread = Math.max(
      0,
      Math.min(total, Math.floor(existingNovel?.unreadChapters ?? total)),
    );

    const targetIndex =
      unread === 0
        ? Math.max(0, Math.min(list.length - 1, lastRead - 1))
        : Math.min(list.length - 1, lastRead);
    const target = list[targetIndex] ?? list[0];
    if (!target) return;
    openChapter(target);
  }, [chapters, existingNovel?.lastReadChapter, existingNovel?.totalChapters, existingNovel?.unreadChapters, openChapter]);

  const handleHeaderBackPress = useCallback(() => {
    if (isChapterSelectionMode) {
      clearChapterSelection();
      return;
    }
    loadTokenRef.current += 1;
    if (persistTimeoutRef.current) {
      clearTimeout(persistTimeoutRef.current);
      persistTimeoutRef.current = null;
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      (navigation as any).navigate("Main", { screen: "Sources" });
    }
  }, [clearChapterSelection, isChapterSelectionMode, navigation]);

  const handleDownloadUnread = useCallback(
    (limit?: number) => {
      if (!existingNovel) {
        Alert.alert("Not in library", "Add this novel to your library to download chapters.");
        return;
      }
      if (chapters.length === 0) return;
      const unread = chapters.filter((c, index) => {
        const isRead = getEffectiveReadForChapter({
          chapterPath: c.path,
          index,
          total: progressTotal,
          baseReadCount,
          order: chapterListOrder,
          readOverrides: existingNovel.chapterReadOverrides,
        });
        return !isRead;
      });
      enqueueManyChapterDownloads(typeof limit === "number" ? unread.slice(0, limit) : unread);
    },
    [
      baseReadCount,
      chapterListOrder,
      chapters,
      enqueueManyChapterDownloads,
      existingNovel,
      progressTotal,
    ],
  );

  const handleDownloadAll = useCallback(() => {
    enqueueManyChapterDownloads(chapters);
  }, [chapters, enqueueManyChapterDownloads]);

  const handleDeleteAllDownloads = useCallback(() => {
    if (!existingNovel) {
      Alert.alert("Not in library", "Add this novel to your library to manage downloads.");
      return;
    }

    const current = existingNovelRef.current;
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
              cancelNovelTasks(existingNovel.id);
              await Promise.all(
                paths.map((p) =>
                  ChapterDownloads.deleteChapterHtml(
                    pluginId,
                    existingNovel.id,
                    p,
                    settings.general.downloadLocation,
                  ),
                ),
              );
              updateNovel(existingNovel.id, {
                chapterDownloaded: undefined,
                isDownloaded: false,
              });
            })();
          },
        },
      ],
    );
  }, [
    cancelNovelTasks,
    existingNovel,
    pluginId,
    settings.general.downloadLocation,
    updateNovel,
  ]);

  const downloadOptions = [
    { id: "next", label: "Next chapter", onPress: () => handleDownloadUnread(1) },
    { id: "next5", label: "Next 5 chapters", onPress: () => handleDownloadUnread(5) },
    { id: "next10", label: "Next 10 chapters", onPress: () => handleDownloadUnread(10) },
    { id: "custom", label: "Custom", onPress: () => {} },
    { id: "unread", label: "Unread", onPress: () => handleDownloadUnread() },
    { id: "all", label: "All", onPress: handleDownloadAll },
    {
      id: "delete",
      label: "Delete downloads",
      isDestructive: true,
      onPress: handleDeleteAllDownloads,
    },
  ];

  const handleMarkRead = () => {
    if (!existingNovel) return;
    const total =
      existingNovel.totalChapters > 0 ? existingNovel.totalChapters : chapters.length;
    updateNovel(existingNovel.id, {
      unreadChapters: 0,
      lastReadChapter: total,
      lastReadDate: new Date(),
    });
  };

  const handleMarkUnread = () => {
    if (!existingNovel) return;
    const total =
      existingNovel.totalChapters > 0 ? existingNovel.totalChapters : chapters.length;
    updateNovel(existingNovel.id, {
      unreadChapters: total,
      lastReadChapter: 0,
      lastReadDate: undefined,
    });
  };

  const moreOptions = [
    { id: "openWeb", label: "Open website", onPress: handleWebView },
    ...(existingNovel
      ? [
          { id: "markRead", label: "Mark as read", onPress: handleMarkRead },
          { id: "markUnread", label: "Mark as unread", onPress: handleMarkUnread },
        ]
      : []),
  ];

  const progressPercent = progressTotal > 0 ? (effectiveReadCount / progressTotal) * 100 : 0;

  const chapterDownloaded = existingNovel?.chapterDownloaded;

  const renderChapterItem = useCallback<ListRenderItem<ChapterItem>>(
    ({ item, index }) => {
      const selected = selectedChapterPaths.has(item.path);
      const isRead = existingNovel
        ? getEffectiveReadForChapter({
            chapterPath: item.path,
            index,
            total: progressTotal,
            baseReadCount,
            order: chapterListOrder,
            readOverrides: existingNovel.chapterReadOverrides,
          })
        : false;
      const downloadInfo = downloadTaskByPath.get(item.path);
      const isDownloaded = Boolean(chapterDownloaded?.[item.path]);

      return (
        <ChapterRow
          chapter={item}
          theme={theme}
          isSelectionMode={isChapterSelectionMode}
          selected={selected}
          isRead={isRead}
          isInLibrary={Boolean(existingNovel)}
          isDownloaded={isDownloaded}
          downloadStatus={downloadInfo?.status}
          onToggleSelected={toggleChapterSelected}
          onOpenChapter={openChapter}
          onEnqueueDownload={enqueueChapterDownload}
        />
      );
    },
    [
      baseReadCount,
      chapterListOrder,
      chapterDownloaded,
      downloadTaskByPath,
      enqueueChapterDownload,
      existingNovel,
      isChapterSelectionMode,
      openChapter,
      progressTotal,
      selectedChapterPaths,
      theme,
      toggleChapterSelected,
    ],
  );

  const listHeader = useMemo(
    () => (
      <>
        <View style={styles.headerSection}>
          <Image
            source={{
              uri: cover || "https://via.placeholder.com/300x450",
            }}
            style={[styles.cover, { width: coverWidth, height: coverHeight }]}
          />
          <View style={styles.headerInfo}>
            <Text
              style={[styles.title, { color: theme.colors.text }]}
              numberOfLines={3}
            >
              {title}
            </Text>
            <Text
              style={[styles.author, { color: theme.colors.textSecondary }]}
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
                <Text style={styles.statusText}>{normalizedStatus}</Text>
              </View>
              <Text
                style={[styles.source, { color: theme.colors.textSecondary }]}
                numberOfLines={1}
              >
                {plugin?.name || pluginId}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
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
            <Text style={[styles.actionButtonText, { color: theme.colors.text }]}>
              WebView
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Summary
          </Text>
          <Text style={[styles.summary, { color: theme.colors.textSecondary }]}>
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
                  <Text style={[styles.genreText, { color: theme.colors.primary }]}>
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
            <Text style={[styles.progressText, { color: theme.colors.primary }]}>
              {effectiveReadCount}/{progressTotal}
            </Text>
          </View>
          <View style={[styles.progressBar, { backgroundColor: theme.colors.border }]}>
            <View
              style={[
                styles.progressFill,
                { backgroundColor: theme.colors.primary, width: `${progressPercent}%` },
              ]}
            />
          </View>
          <Text style={[styles.chapterCount, { color: theme.colors.textSecondary }]}>
            {progressTotal} chapters
          </Text>
        </TouchableOpacity>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Chapters
          </Text>
        </View>
      </>
    ),
    [
      author,
      chapters.length,
      cover,
      coverHeight,
      coverWidth,
      effectiveReadCount,
      genres,
      handleAddToLibrary,
      handleLibraryToggle,
      handleProgressPress,
      handleWebView,
      isInLibrary,
      normalizedStatus,
      plugin?.name,
      pluginId,
      progressPercent,
      progressTotal,
      summary,
      theme,
      title,
    ],
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
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
          )
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
        <FlashList
          data={chapters}
          keyExtractor={(item) => item.path}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={listHeader}
          renderItem={renderChapterItem}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={Platform.OS === "android"}
          extraData={selectedChapterPaths}
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
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
