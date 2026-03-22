// src/screens/library/NovelDetailScreen.tsx
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Header } from "../../components/common/Header";
import { PopupMenu } from "../../components/common/PopupMenu";
import { SelectionModal } from "../../components/common/SelectionModal";
import { TrackingSearchModal } from "../../components/tracking/TrackingSearchModal";
import { useDownloadQueue } from "../../context/DownloadQueueContext";
import { useHistory } from "../../context/HistoryContext";
import { useLibrary } from "../../context/LibraryContext";
import { useSettings } from "../../context/SettingsContext";
import { useTheme } from "../../context/ThemeContext";
import { ChapterDownloads } from "../../services/chapterDownloads";
import { AndroidProgressNotifications } from "../../services/androidProgressNotifications";
import type { EpubExportCoverImage } from "../../services/epubExport";
import { EpubExportService } from "../../services/epubExport";
import { getTracker, trackers } from "../../services/tracking/registry";
import { TrackingService } from "../../services/tracking/TrackingService";
import {
  normalizePluginDetailForCache,
  NovelDetailCache,
} from "../../services/novelDetailCache";
import { PluginRuntimeService } from "../../services/pluginRuntime";
import type { CachedPluginNovelDetail, Novel, TrackerId } from "../../types";
import {
  computeTotalEffectiveReadCount,
  detectChapterListOrder,
  getEffectiveReadForChapter,
  pickResumeChapter,
  updateReadOverridesForSelection,
} from "../../utils/chapterState";
import { clamp } from "../../utils/responsive";

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Chapter Row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const ChapterItem = React.memo(
  ({
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
    enqueueChapterDownload,
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
    const dlIcon = (() => {
      if (isDownloaded)
        return {
          name: "checkmark-circle" as const,
          color: theme.colors.success,
        };
      if (downloadInfo?.status === "downloading") return null;
      if (downloadInfo?.status === "pending")
        return {
          name: "time-outline" as const,
          color: theme.colors.textSecondary,
        };
      if (downloadInfo?.status === "error")
        return {
          name: "alert-circle-outline" as const,
          color: theme.colors.error,
        };
      return {
        name: "arrow-down-circle-outline" as const,
        color: theme.colors.textSecondary,
      };
    })();

    return (
      <TouchableOpacity
        style={[
          styles.chapterRow,
          selected && { backgroundColor: theme.colors.primary + "14" },
          { borderBottomColor: theme.colors.divider },
        ]}
        onPress={() => {
          if (isChapterSelectionMode) {
            toggleChapterSelected(item.path);
            return;
          }
          handlePluginChapterPress(item);
        }}
        onLongPress={() => toggleChapterSelected(item.path)}
        delayLongPress={380}
        activeOpacity={0.75}
      >
        {/* Read stripe */}
        <View
          style={[
            styles.chapterStripe,
            {
              backgroundColor: isRead
                ? theme.colors.primary + "40"
                : "transparent",
            },
          ]}
        />

        {/* Checkbox or chapter number */}
        {isChapterSelectionMode ? (
          <View style={styles.chapterNumWrap}>
            <Ionicons
              name={selected ? "checkmark-circle" : "ellipse-outline"}
              size={22}
              color={
                selected ? theme.colors.primary : theme.colors.textSecondary
              }
            />
          </View>
        ) : (
          <View style={styles.chapterNumWrap}>
            <Text
              style={[
                styles.chapterNum,
                {
                  color: isRead
                    ? theme.colors.textSecondary
                    : theme.colors.primary,
                },
              ]}
            >
              {item.chapterNumber ?? index + 1}
            </Text>
          </View>
        )}

        {/* Title & date */}
        <View style={styles.chapterMeta}>
          <Text
            style={[
              styles.chapterTitle,
              {
                color: isRead ? theme.colors.textSecondary : theme.colors.text,
              },
            ]}
            numberOfLines={2}
          >
            {item.name}
          </Text>
          {!!item.releaseTime && (
            <Text
              style={[
                styles.chapterDate,
                { color: theme.colors.textSecondary },
              ]}
              numberOfLines={1}
            >
              {item.releaseTime}
            </Text>
          )}
        </View>

        {/* Download button */}
        {!isChapterSelectionMode && (
          <TouchableOpacity
            onPress={() => {
              if (isDownloaded) return;
              if (
                downloadInfo?.status === "pending" ||
                downloadInfo?.status === "downloading"
              )
                return;
              enqueueChapterDownload(item);
            }}
            style={styles.dlBtn}
            hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
          >
            {downloadInfo?.status === "downloading" ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : dlIcon ? (
              <Ionicons name={dlIcon.name} size={20} color={dlIcon.color} />
            ) : null}
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  },
);

ChapterItem.displayName = "ChapterItem";

// â”€â”€â”€ Main Screen â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const NovelDetailScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { theme } = useTheme();
  const { settings } = useSettings();
  const { novels, updateNovel, removeNovel, categories } = useLibrary();
  const { historyEntries, upsertHistoryEntry } = useHistory();
  const {
    tasks: downloadTasks,
    enqueue,
    cancelTask,
    cancelNovelTasks,
  } = useDownloadQueue();
  const { width: SW } = useWindowDimensions();

  const coverWidth = clamp(Math.round(Math.min(SW * 0.28, 160)), 96, 160);
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

  // â”€â”€ State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [isDownloadMenuVisible, setIsDownloadMenuVisible] = useState(false);
  const [isMoreMenuVisible, setIsMoreMenuVisible] = useState(false);
  const [isTrackerPickerVisible, setIsTrackerPickerVisible] = useState(false);
  const [isTrackingSearchVisible, setIsTrackingSearchVisible] = useState(false);
  const [trackingTrackerId, setTrackingTrackerId] =
    useState<TrackerId>("anilist");
  const [isTrackingSyncing, setIsTrackingSyncing] = useState(false);
  const [isEpubExporting, setIsEpubExporting] = useState(false);
  const [epubExportProgress, setEpubExportProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
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
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false);
  const [pendingCategoryId, setPendingCategoryId] = useState<string | null>(
    null,
  );
  const [isEditInfoModalVisible, setIsEditInfoModalVisible] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editAuthor, setEditAuthor] = useState("");
  const [editSummary, setEditSummary] = useState("");
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

  useEffect(() => {
    if (!isCategoryModalVisible) return;
    if (pendingCategoryId) return;
    const existing = novel?.categoryId;
    setPendingCategoryId(
      (existing &&
        categoryChoices.some((c) => c.id === existing) &&
        existing) ||
        categoryChoices[0]?.id ||
        null,
    );
  }, [
    categoryChoices,
    isCategoryModalVisible,
    novel?.categoryId,
    pendingCategoryId,
  ]);

  useEffect(() => {
    setIsInLibrary(Boolean(novel?.isInLibrary));
  }, [novel?.isInLibrary]);

  // â”€â”€ Data fetch â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

      if (cached && cached !== mem) NovelDetailCache.set(stableKey, cached);

      if (cached) {
        setRemoteError(null);
        setRemoteDetail(cached.detail);
        setRemoteChapters(cached.chapters);
        setChaptersPage(cached.chaptersPage);
        setChaptersHasMore(cached.chaptersHasMore);

        if (cached.detail) {
          const updates: Partial<Novel> = {};
          const rTitle = String(cached.detail?.name || novel.title);
          const rAuthor = String(
            cached.detail?.author || novel.author || "Unknown",
          );
          const rCover = String(cached.detail?.cover || novel.coverUrl);
          const rSummary = String(
            cached.detail?.summary || novel.summary || "",
          );
          const rGenres = Array.isArray(cached.detail?.genres)
            ? cached.detail.genres.map((g: any) => String(g))
            : novel.genres;
          const rTotalChapters =
            typeof cached.detail?.totalChapters === "number"
              ? cached.detail.totalChapters
              : undefined;
          const rStatusRaw = String(cached.detail?.status || "").toLowerCase();
          const rStatus: Novel["status"] | undefined = cached.detail?.status
            ? rStatusRaw.includes("complete") ||
              rStatusRaw.includes("end") ||
              rStatusRaw.includes("finished")
              ? "completed"
              : "ongoing"
            : undefined;
          if (rTitle && rTitle !== novel.title) updates.title = rTitle;
          if (rAuthor && rAuthor !== novel.author) updates.author = rAuthor;
          if (rCover && rCover !== novel.coverUrl) updates.coverUrl = rCover;
          if (rSummary !== novel.summary) updates.summary = rSummary;
          if (rStatus && rStatus !== novel.status) updates.status = rStatus;
          if (
            Array.isArray(cached.detail?.genres) &&
            (novel.genres.length !== rGenres.length ||
              novel.genres.some((g, i) => g !== rGenres[i]))
          )
            updates.genres = rGenres;
          if (rTotalChapters != null && rTotalChapters !== novel.totalChapters)
            updates.totalChapters = rTotalChapters;
          if (Object.keys(updates).length > 0) updateNovel(novel.id, updates);
        }

        if (cached.signature === fetchSignature) return;
      }

      if (!linkedPlugin) {
        if (!cached) {
          setRemoteError("Source plugin is not installed.");
        }
        return;
      }
      if (!linkedPlugin.enabled) {
        if (!cached) {
          setRemoteError("Source plugin is disabled.");
        }
        return;
      }
      if (fetchSignature && lastFetchKeyRef.current === fetchSignature) return;

      try {
        if (!cached) setIsRemoteLoading(true);
        setRemoteError(null);
        if (!cached) {
          setChaptersPage(1);
          setChaptersHasMore(false);
        }

        const instance = await PluginRuntimeService.loadLnReaderPlugin(
          linkedPlugin,
          { userAgent: settings.advanced.userAgent },
        );
        const parseNovel =
          (instance as any).parseNovelAndChapters ||
          (instance as any).parseNovel;
        if (typeof parseNovel !== "function")
          throw new Error("This source does not support novel details.");

        const data = await parseNovel(novel.pluginNovelPath);
        lastFetchKeyRef.current = fetchSignature;
        const normalizedDetail = normalizePluginDetailForCache(data);
        setRemoteDetail(normalizedDetail);

        const chaptersRaw = Array.isArray(data?.chapters) ? data.chapters : [];
        const chaptersMapped = chaptersRaw
          .map((c: any) => ({
            name: String(c?.name || ""),
            path: String(c?.path || ""),
            releaseTime: c?.releaseTime ?? null,
            chapterNumber:
              typeof c?.chapterNumber === "number"
                ? c.chapterNumber
                : typeof c?.number === "number"
                  ? c.number
                  : undefined,
          }))
          .filter(isPluginChapterItem);
        setRemoteChapters(chaptersMapped);
        setChaptersPage(1);

        const totalFromDetail = normalizedDetail?.totalChapters;
        const canPage =
          typeof (instance as any).fetchChaptersPage === "function";
        setChaptersHasMore(
          canPage &&
            (totalFromDetail != null
              ? chaptersMapped.length < totalFromDetail
              : false),
        );

        const cacheEntry: CachedPluginNovelDetail = {
          signature: fetchSignature ?? "",
          cachedAt: Date.now(),
          detail: normalizedDetail,
          chapters: chaptersMapped,
          chaptersPage: 1,
          chaptersHasMore:
            canPage &&
            (totalFromDetail != null
              ? chaptersMapped.length < totalFromDetail
              : false),
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
            ? (normalizedDetail?.genres as any)
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
    void run();
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

  // â”€â”€ Display values â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Progress â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const chaptersTotal = remoteChapters.length;
  const progressTotal = novel?.totalChapters
    ? Math.max(0, novel.totalChapters)
    : chaptersTotal;
  const chapterListOrder = useMemo(
    () => detectChapterListOrder(remoteChapters),
    [remoteChapters],
  );
  const baseReadCount = useMemo(() => {
    if (!novel) return 0;
    return Math.max(
      0,
      Math.min(progressTotal, Math.floor(novel.lastReadChapter || 0)),
    );
  }, [novel, progressTotal]);
  const effectiveReadCount = useMemo(() => {
    if (!novel) return 0;
    // If we don't have the full chapter list loaded, we cannot reliably map
    // per-chapter overrides into the overall progress count.
    if (remoteChapters.length !== progressTotal) return baseReadCount;
    return computeTotalEffectiveReadCount({
      total: progressTotal,
      baseReadCount,
      order: chapterListOrder,
      chapters: remoteChapters,
      readOverrides: novel.chapterReadOverrides,
    });
  }, [baseReadCount, chapterListOrder, novel, progressTotal, remoteChapters]);
  const progressPercent =
    progressTotal > 0 ? (effectiveReadCount / progressTotal) * 100 : 0;

  const readStatusByPath = useMemo(() => {
    const map = new Map<string, boolean>();
    if (!novel) return map;
    remoteChapters.forEach((c, index) => {
      map.set(
        c.path,
        getEffectiveReadForChapter({
          chapterPath: c.path,
          index,
          total: remoteChapters.length,
          baseReadCount: Math.min(baseReadCount, remoteChapters.length),
          order: chapterListOrder,
          readOverrides: novel.chapterReadOverrides,
        }),
      );
    });
    return map;
  }, [baseReadCount, chapterListOrder, novel, remoteChapters]);

  const historyEntry = useMemo(
    () => historyEntries.find((e) => e.id === novel?.id),
    [historyEntries, novel?.id],
  );

  const resumeTarget = useMemo(() => {
    if (!novel || remoteChapters.length === 0) return null;
    return pickResumeChapter({
      chapters: remoteChapters,
      order: chapterListOrder,
      baseReadCount: Math.min(baseReadCount, remoteChapters.length),
      readOverrides: novel.chapterReadOverrides,
      lastReadPath: historyEntry?.lastReadChapter?.id,
    });
  }, [
    baseReadCount,
    chapterListOrder,
    historyEntry?.lastReadChapter?.id,
    novel,
    remoteChapters,
  ]);

  const downloadTaskByPath = useMemo(() => {
    const map = new Map<string, { id: string; status: string }>();
    if (!novel?.pluginId) return map;
    for (const task of downloadTasks) {
      if (task.pluginId !== novel.pluginId || task.novelId !== novel.id)
        continue;
      if (
        task.status === "pending" ||
        task.status === "downloading" ||
        task.status === "error"
      )
        map.set(task.chapterPath, { id: task.id, status: task.status });
    }
    return map;
  }, [downloadTasks, novel?.id, novel?.pluginId]);

  // â”€â”€ Handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handlePluginChapterPress = useCallback(
    (chapter: PluginChapterItem) => {
      if (!novel?.pluginId) return;
      (navigation as any).navigate("Reader", {
        novelId: novel.id,
        chapterId: chapter.path,
      });
    },
    [navigation, novel],
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
      if (!novel?.pluginId || !Array.isArray(chapters) || chapters.length === 0)
        return;
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
    [
      enqueue,
      linkedPlugin?.name,
      novel?.id,
      novel?.pluginId,
      novel?.source,
      novel?.title,
    ],
  );

  const handleDownloadUnread = useCallback(
    (limit?: number) => {
      if (!novel?.pluginId || remoteChapters.length === 0) return;
      const unread = remoteChapters.filter(
        (c, index) =>
          !getEffectiveReadForChapter({
            chapterPath: c.path,
            index,
            total: remoteChapters.length,
            baseReadCount: Math.min(baseReadCount, remoteChapters.length),
            order: chapterListOrder,
            readOverrides: novel.chapterReadOverrides,
          }),
      );
      enqueueManyChapterDownloads(
        typeof limit === "number" ? unread.slice(0, limit) : unread,
      );
    },
    [
      baseReadCount,
      chapterListOrder,
      enqueueManyChapterDownloads,
      novel,
      remoteChapters,
    ],
  );

  const handleDownloadNext = useCallback(
    (limit: number) => {
      if (!novel?.pluginId || remoteChapters.length === 0) return;
      const undownloaded = remoteChapters.filter(
        (c) => !Boolean(novel?.chapterDownloaded?.[c.path]),
      );
      if (undownloaded.length === 0) {
        Alert.alert("No New Chapters", "All chapters are already downloaded.");
        return;
      }
      enqueueManyChapterDownloads(undownloaded.slice(0, limit));
    },
    [enqueueManyChapterDownloads, novel, remoteChapters],
  );

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

  const handleWebView = useCallback(() => {
    const toAbsoluteHttpUrl = (input: string, base?: string) => {
      const raw = String(input || "").trim();
      if (!raw) return "";
      if (raw.startsWith("//")) return `https:${raw}`;
      if (/^https?:\/\//i.test(raw)) return raw;

      const baseRaw = String(base || "").trim();
      if (!baseRaw) return "";
      const baseNorm = baseRaw.startsWith("//") ? `https:${baseRaw}` : baseRaw;
      if (!/^https?:\/\//i.test(baseNorm)) return "";

      try {
        return new URL(raw, baseNorm).toString();
      } catch {
        return "";
      }
    };

    const pluginSite = novel?.pluginId
      ? String(settings.extensions.installedPlugins?.[novel.pluginId]?.site || "")
      : "";
    const siteBase = toAbsoluteHttpUrl(pluginSite);

    const novelPath = String(novel?.pluginNovelPath || "");
    const novelUrl =
      toAbsoluteHttpUrl(String(remoteDetail?.url || "")) ||
      toAbsoluteHttpUrl(novelPath) ||
      toAbsoluteHttpUrl(novelPath, siteBase) ||
      siteBase ||
      `https://example.com/novel/${novel?.id || ""}`;

    const url = novelUrl;
    (navigation as any).navigate("WebView", { url });
  }, [
    navigation,
    novel?.id,
    novel?.pluginId,
    novel?.pluginNovelPath,
    remoteDetail?.url,
    settings.extensions.installedPlugins,
  ]);

  const handleMarkRead = () => {
    if (!novel) return;
    const total = novel.totalChapters > 0 ? novel.totalChapters : chaptersTotal;
    const now = new Date();
    updateNovel(novel.id, {
      unreadChapters: 0,
      lastReadChapter: total,
      lastReadDate: now,
      chapterReadOverrides: undefined,
    });

    if (remoteChapters.length > 0) {
      const target =
        pickResumeChapter({
          chapters: remoteChapters,
          order: chapterListOrder,
          baseReadCount: remoteChapters.length,
          readOverrides: undefined,
          lastReadPath: null,
        })?.chapter ?? remoteChapters[0];

      upsertHistoryEntry({
        id: novel.id,
        novel: { ...novel, pluginCache: undefined } as any,
        lastReadChapter: {
          id: target.path,
          novelId: novel.id,
          title: target.name || "Chapter",
          number: Math.min(total, remoteChapters.length),
          isRead: true,
          isDownloaded: Boolean(novel?.chapterDownloaded?.[target.path]),
          releaseDate: now,
        },
        progress: 100,
        totalChaptersRead: total,
        lastReadDate: now,
        timeSpentReading: historyEntry?.timeSpentReading || 0,
      });
    }
  };
  const handleMarkUnread = () => {
    if (!novel) return;
    const total = novel.totalChapters > 0 ? novel.totalChapters : chaptersTotal;
    const now = new Date();
    updateNovel(novel.id, {
      unreadChapters: total,
      lastReadChapter: 0,
      lastReadDate: undefined,
      chapterReadOverrides: undefined,
    });

    if (remoteChapters.length > 0) {
      const target =
        pickResumeChapter({
          chapters: remoteChapters,
          order: chapterListOrder,
          baseReadCount: 0,
          readOverrides: undefined,
          lastReadPath: null,
        })?.chapter ?? remoteChapters[0];

      upsertHistoryEntry({
        id: novel.id,
        novel: { ...novel, pluginCache: undefined } as any,
        lastReadChapter: {
          id: target.path,
          novelId: novel.id,
          title: target.name || "Chapter",
          number: 1,
          isRead: false,
          isDownloaded: Boolean(novel?.chapterDownloaded?.[target.path]),
          releaseDate: now,
        },
        progress: 0,
        totalChaptersRead: 0,
        lastReadDate: now,
        timeSpentReading: historyEntry?.timeSpentReading || 0,
      });
    }
  };

  const openEditInfo = useCallback(() => {
    if (!novel) return;
    setEditTitle(String(novel.title || ""));
    setEditAuthor(String(novel.author || ""));
    setEditSummary(String(novel.summary || ""));
    setIsMoreMenuVisible(false);
    setIsEditInfoModalVisible(true);
  }, [novel]);

  const saveEditInfo = useCallback(() => {
    if (!novel) return;
    const nextTitle = editTitle.trim();
    if (!nextTitle) {
      Alert.alert("Invalid title", "Title cannot be empty.");
      return;
    }
    updateNovel(novel.id, {
      title: nextTitle,
      author: editAuthor.trim(),
      summary: editSummary,
    });
    setIsEditInfoModalVisible(false);
  }, [editAuthor, editSummary, editTitle, novel, updateNovel]);

  const handleEditCover = useCallback(() => {
    if (!novel) return;
    setIsMoreMenuVisible(false);

    Alert.alert("Edit cover", "Choose a new cover image or remove the current one.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => updateNovel(novel.id, { coverUrl: "" }),
      },
      {
        text: "Choose image",
        onPress: async () => {
          try {
            const res = await DocumentPicker.getDocumentAsync({
              type: ["image/*"],
              multiple: false,
              copyToCacheDirectory: true,
            });
            if (res.canceled || !res.assets?.[0]?.uri) return;
            const asset = res.assets[0];
            const srcUri = asset.uri;
            const name = String(asset.name || "cover");
            const extMatch = name.match(/\.([a-z0-9]+)$/i);
            const ext = extMatch ? extMatch[1].toLowerCase() : "jpg";

            const dir = `${FileSystem.documentDirectory}covers/`;
            await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(
              () => {},
            );
            const dest = `${dir}${novel.id}.${ext}`;
            await FileSystem.copyAsync({ from: srcUri, to: dest });

            updateNovel(novel.id, { coverUrl: dest });
          } catch (e: any) {
            Alert.alert("Cover update failed", e?.message || "Could not update cover.");
          }
        },
      },
    ]);
  }, [novel, updateNovel]);

  const handleLibraryToggle = useCallback(() => {
    if (!novel) return;
    if (isInLibrary) {
      removeNovel(novel.id);
      if ((navigation as any).canGoBack?.()) (navigation as any).goBack();
      else (navigation as any).navigate("Main", { screen: "Library" });
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
  }, [
    novel,
    isInLibrary,
    removeNovel,
    navigation,
    categoryChoices,
    updateNovel,
  ]);

  const handleProgressPress = useCallback(() => {
    if (!novel?.pluginId || remoteChapters.length === 0) return;
    const target = resumeTarget?.chapter ?? remoteChapters[0];
    if (target) handlePluginChapterPress(target);
  }, [handlePluginChapterPress, novel?.pluginId, remoteChapters, resumeTarget]);

  const handleRefresh = useCallback(async () => {
    if (!novel?.pluginId || !novel?.pluginNovelPath) return;
    setIsRefreshing(true);
    try {
      lastFetchKeyRef.current = null;
      if (!linkedPlugin) {
        setRemoteError("Source plugin is not installed.");
        return;
      }
      if (!linkedPlugin.enabled) {
        setRemoteError("Source plugin is disabled.");
        return;
      }
      setRemoteError(null);
      setChaptersPage(1);
      const instance = await PluginRuntimeService.loadLnReaderPlugin(
        linkedPlugin,
        { userAgent: settings.advanced.userAgent },
      );
      const parseNovel =
        (instance as any).parseNovelAndChapters || (instance as any).parseNovel;
      if (typeof parseNovel !== "function")
        throw new Error("This source does not support novel details.");
      const data = await parseNovel(novel.pluginNovelPath);
      const normalizedDetail = normalizePluginDetailForCache(data);
      setRemoteDetail(normalizedDetail);
      const chaptersRaw = Array.isArray(data?.chapters) ? data.chapters : [];
      const chaptersMapped = chaptersRaw
        .map((c: any) => ({
          name: String(c?.name || ""),
          path: String(c?.path || ""),
          releaseTime: c?.releaseTime ?? null,
          chapterNumber:
            typeof c?.chapterNumber === "number"
              ? c.chapterNumber
              : typeof c?.number === "number"
                ? c.number
                : undefined,
        }))
        .filter(isPluginChapterItem);
      setRemoteChapters(chaptersMapped);
      setChaptersPage(1);
      const totalFromDetail = normalizedDetail?.totalChapters;
      const canPage = typeof (instance as any).fetchChaptersPage === "function";
      setChaptersHasMore(
        canPage &&
          (totalFromDetail != null
            ? chaptersMapped.length < totalFromDetail
            : false),
      );
      const signature = NovelDetailCache.signature({
        novelId: novel.id,
        pluginId: novel.pluginId,
        novelPath: novel.pluginNovelPath,
        pluginVersion: linkedPlugin?.version,
        pluginUrl: linkedPlugin?.url,
        pluginLocalPath: linkedPlugin?.localPath,
        userAgent: settings.advanced.userAgent,
      });
      const cacheEntry: CachedPluginNovelDetail = {
        signature,
        cachedAt: Date.now(),
        detail: normalizedDetail,
        chapters: chaptersMapped,
        chaptersPage: 1,
        chaptersHasMore:
          canPage &&
          (totalFromDetail != null
            ? chaptersMapped.length < totalFromDetail
            : false),
      };
      const stableKey =
        cacheKey ?? NovelDetailCache.key(novel.pluginId, novel.pluginNovelPath);
      NovelDetailCache.set(stableKey, cacheEntry);
      const statusRaw = String(normalizedDetail?.status || "").toLowerCase();
      updateNovel(novel.id, {
        title: String(normalizedDetail?.name || novel.title),
        author: String(normalizedDetail?.author || novel.author || "Unknown"),
        coverUrl: String(normalizedDetail?.cover || novel.coverUrl),
        status: normalizedDetail?.status
          ? statusRaw.includes("complete") ||
            statusRaw.includes("end") ||
            statusRaw.includes("finished")
            ? "completed"
            : "ongoing"
          : novel.status,
        summary: String(normalizedDetail?.summary || novel.summary || ""),
        genres: Array.isArray(normalizedDetail?.genres)
          ? (normalizedDetail?.genres as any)
          : novel.genres,
        totalChapters:
          totalFromDetail != null
            ? totalFromDetail
            : chaptersMapped.length || novel.totalChapters,
        pluginCache: cacheEntry,
      });
    } catch (e: any) {
      setRemoteError(e?.message || "Failed to refresh.");
    } finally {
      setIsRefreshing(false);
    }
  }, [novel, linkedPlugin, settings.advanced.userAgent, cacheKey, updateNovel]);

  const loadMoreChapters = useCallback(async () => {
    if (!novel?.pluginId || !novel?.pluginNovelPath) return;
    if (
      !linkedPlugin ||
      !linkedPlugin.enabled ||
      !chaptersHasMore ||
      isRemoteLoading ||
      isChaptersLoadingMore
    )
      return;
    try {
      setIsChaptersLoadingMore(true);
      const instance = await PluginRuntimeService.loadLnReaderPlugin(
        linkedPlugin,
        { userAgent: settings.advanced.userAgent },
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
      const mapped = raw
        .map((c: any) => ({
          name: String(c?.name || ""),
          path: String(c?.path || ""),
          releaseTime: c?.releaseTime ?? null,
          chapterNumber:
            typeof c?.chapterNumber === "number"
              ? c.chapterNumber
              : typeof c?.number === "number"
                ? c.number
                : undefined,
        }))
        .filter(isPluginChapterItem);
      const appliedPage = typeof res?.page === "number" ? res.page : nextPage;
      const explicitHasMore =
        typeof res?.hasMore === "boolean" ? res.hasMore : undefined;
      const totalFromDetail =
        typeof remoteDetail?.totalChapters === "number"
          ? remoteDetail.totalChapters
          : undefined;
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
      const cacheEntry: CachedPluginNovelDetail = {
        signature,
        cachedAt: Date.now(),
        detail:
          remoteDetail ??
          NovelDetailCache.get(stableKey)?.detail ??
          novel.pluginCache?.detail ??
          null,
        chapters: next,
        chaptersPage: appliedPage,
        chaptersHasMore: nextHasMore,
      };
      NovelDetailCache.set(stableKey, cacheEntry);
      updateNovel(novel.id, { pluginCache: cacheEntry });
    } catch {
      /* ignore */
    } finally {
      setIsChaptersLoadingMore(false);
    }
  }, [
    novel,
    linkedPlugin,
    chaptersHasMore,
    isRemoteLoading,
    isChaptersLoadingMore,
    settings.advanced.userAgent,
    chaptersPage,
    remoteDetail,
    remoteChapters,
    cacheKey,
    fetchSignature,
    updateNovel,
  ]);

  // â”€â”€ Chapter selection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    if (!novel || selectedChapterPaths.size === 0) return;
    const now = new Date();
    if (
      remoteChapters.length > 0 &&
      selectedChapterPaths.size === remoteChapters.length
    ) {
      updateNovel(novel.id, {
        unreadChapters: 0,
        lastReadChapter: progressTotal,
        lastReadDate: now,
        chapterReadOverrides: undefined,
      });
      const last =
        pickResumeChapter({
          chapters: remoteChapters,
          order: chapterListOrder,
          baseReadCount: remoteChapters.length,
          readOverrides: undefined,
          lastReadPath: null,
        })?.chapter ?? remoteChapters[0];

      upsertHistoryEntry({
        id: novel.id,
        novel: { ...novel, pluginCache: undefined } as any,
        lastReadChapter: {
          id: last.path,
          novelId: novel.id,
          title: last.name || "Chapter",
          number: Math.max(1, remoteChapters.length),
          isRead: true,
          isDownloaded: Boolean(novel?.chapterDownloaded?.[last.path]),
          releaseDate: now,
        },
        progress: 100,
        totalChaptersRead: progressTotal,
        lastReadDate: now,
        timeSpentReading: historyEntry?.timeSpentReading || 0,
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
      lastReadDate: now,
      chapterReadOverrides: nextOverrides,
    });

    const resume = pickResumeChapter({
      chapters: remoteChapters,
      order: chapterListOrder,
      baseReadCount: Math.min(baseReadCount, remoteChapters.length),
      readOverrides: nextOverrides,
      lastReadPath: historyEntry?.lastReadChapter?.id,
    });
    const target = resume?.chapter ?? remoteChapters[0];
    const isRead = getEffectiveReadForChapter({
      chapterPath: target.path,
      index: resume?.index ?? 0,
      total: remoteChapters.length,
      baseReadCount: Math.min(baseReadCount, remoteChapters.length),
      order: chapterListOrder,
      readOverrides: nextOverrides,
    });

    upsertHistoryEntry({
      id: novel.id,
      novel: { ...novel, pluginCache: undefined } as any,
      lastReadChapter: {
        id: target.path,
        novelId: novel.id,
        title: target.name || "Chapter",
        number: (resume?.index ?? 0) + 1,
        isRead,
        isDownloaded: Boolean(novel?.chapterDownloaded?.[target.path]),
        releaseDate: now,
      },
      progress: progressTotal > 0 ? (nextReadCount / progressTotal) * 100 : 0,
      totalChaptersRead: nextReadCount,
      lastReadDate: now,
      timeSpentReading: historyEntry?.timeSpentReading || 0,
    });
    clearChapterSelection();
  }, [
    baseReadCount,
    chapterListOrder,
    clearChapterSelection,
    historyEntry?.lastReadChapter?.id,
    historyEntry?.timeSpentReading,
    novel,
    progressTotal,
    remoteChapters,
    selectedChapterPaths,
    updateNovel,
    upsertHistoryEntry,
  ]);

  const markSelectedChaptersUnread = useCallback(() => {
    if (!novel || selectedChapterPaths.size === 0) return;
    const now = new Date();
    if (
      remoteChapters.length > 0 &&
      selectedChapterPaths.size === remoteChapters.length
    ) {
      updateNovel(novel.id, {
        unreadChapters: progressTotal,
        lastReadChapter: 0,
        lastReadDate: undefined,
        chapterReadOverrides: undefined,
      });
      const first =
        pickResumeChapter({
          chapters: remoteChapters,
          order: chapterListOrder,
          baseReadCount: 0,
          readOverrides: undefined,
          lastReadPath: null,
        })?.chapter ?? remoteChapters[0];

      upsertHistoryEntry({
        id: novel.id,
        novel: { ...novel, pluginCache: undefined } as any,
        lastReadChapter: {
          id: first.path,
          novelId: novel.id,
          title: first.name || "Chapter",
          number: 1,
          isRead: false,
          isDownloaded: Boolean(novel?.chapterDownloaded?.[first.path]),
          releaseDate: now,
        },
        progress: 0,
        totalChaptersRead: 0,
        lastReadDate: now,
        timeSpentReading: historyEntry?.timeSpentReading || 0,
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

    const resume = pickResumeChapter({
      chapters: remoteChapters,
      order: chapterListOrder,
      baseReadCount: Math.min(baseReadCount, remoteChapters.length),
      readOverrides: nextOverrides,
      lastReadPath: historyEntry?.lastReadChapter?.id,
    });
    const target = resume?.chapter ?? remoteChapters[0];
    const isRead = getEffectiveReadForChapter({
      chapterPath: target.path,
      index: resume?.index ?? 0,
      total: remoteChapters.length,
      baseReadCount: Math.min(baseReadCount, remoteChapters.length),
      order: chapterListOrder,
      readOverrides: nextOverrides,
    });

    upsertHistoryEntry({
      id: novel.id,
      novel: { ...novel, pluginCache: undefined } as any,
      lastReadChapter: {
        id: target.path,
        novelId: novel.id,
        title: target.name || "Chapter",
        number: (resume?.index ?? 0) + 1,
        isRead,
        isDownloaded: Boolean(novel?.chapterDownloaded?.[target.path]),
        releaseDate: now,
      },
      progress: progressTotal > 0 ? (nextReadCount / progressTotal) * 100 : 0,
      totalChaptersRead: nextReadCount,
      lastReadDate: now,
      timeSpentReading: historyEntry?.timeSpentReading || 0,
    });
    clearChapterSelection();
  }, [
    baseReadCount,
    chapterListOrder,
    clearChapterSelection,
    historyEntry?.lastReadChapter?.id,
    historyEntry?.timeSpentReading,
    novel,
    progressTotal,
    remoteChapters,
    selectedChapterPaths,
    updateNovel,
    upsertHistoryEntry,
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
                if (
                  task.pluginId !== pluginId ||
                  task.novelId !== novelId ||
                  !selectedChapterPaths.has(task.chapterPath)
                )
                  continue;
                if (task.status === "pending" || task.status === "downloading")
                  cancelTask(task.id);
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
      {
        id: "selectAll",
        label: "Select all",
        icon: "checkmark-circle-outline" as const,
        onPress: selectAllChapters,
      },
      {
        id: "invert",
        label: "Invert selection",
        icon: "swap-horizontal-outline" as const,
        onPress: invertChapterSelection,
      },
      {
        id: "read",
        label: "Mark as read",
        icon: "checkmark-done-outline" as const,
        onPress: markSelectedChaptersRead,
      },
      {
        id: "unread",
        label: "Mark as unread",
        icon: "ellipse-outline" as const,
        onPress: markSelectedChaptersUnread,
      },
      {
        id: "delete",
        label: "Delete downloads",
        icon: "trash-outline" as const,
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

  const handleExportEpub = useCallback(async () => {
    if (isEpubExporting) return;
    if (!novel) return;
    if (!novel.pluginId) {
      Alert.alert("Export EPUB", "This novel does not have a source plugin.");
      return;
    }

    const chapterSource: PluginChapterItem[] = remoteChapters.length
      ? remoteChapters
      : ((novel.pluginCache?.chapters as any) ?? []);

    const downloadedMap = novel.chapterDownloaded || {};
    const downloadedPaths = new Set(
      Object.keys(downloadedMap).filter((p) => downloadedMap[p]),
    );
    if (downloadedPaths.size === 0) {
      Alert.alert(
        "Export EPUB",
        "No downloaded chapters found. Download some chapters first.",
      );
      return;
    }

    const order = detectChapterListOrder(chapterSource);
    const orderedChapters =
      order === "desc" ? [...chapterSource].reverse() : [...chapterSource];

    const exportCandidates = orderedChapters.filter((c) =>
      downloadedPaths.has(c.path),
    );

    const exportList =
      exportCandidates.length > 0
        ? exportCandidates
        : Array.from(downloadedPaths).map((p) => ({ name: p, path: p }));

    setIsEpubExporting(true);
    setEpubExportProgress({ current: 0, total: exportList.length });
    AndroidProgressNotifications.setTask("epubExport", {
      title: "Exporting EPUB",
      body: novel.title || "Untitled",
      progress: { current: 0, max: exportList.length, indeterminate: false },
    });

    try {
      const chapters: { title: string; html: string; sourceUrl?: string }[] =
        [];
      let missingFiles = 0;

      for (let i = 0; i < exportList.length; i++) {
        const c = exportList[i];
        setEpubExportProgress({ current: i + 1, total: exportList.length });
        AndroidProgressNotifications.setTask("epubExport", {
          title: "Exporting EPUB",
          body: `${String(c.name || `Chapter ${i + 1}`)}\n${i + 1}/${exportList.length}`,
          progress: {
            current: i + 1,
            max: exportList.length,
            indeterminate: false,
          },
        });
        const html = await ChapterDownloads.readChapterHtml(
          novel.pluginId,
          novel.id,
          c.path,
          settings.general.downloadLocation,
        );
        if (!html) {
          missingFiles++;
          continue;
        }
        chapters.push({
          title: String(c.name || `Chapter ${i + 1}`),
          html,
          sourceUrl: c.path,
        });
      }

      if (chapters.length === 0) {
        throw new Error("Could not read any downloaded chapter files.");
      }

      const getCoverImage = async (): Promise<EpubExportCoverImage | null> => {
        const coverUrl = String(novel.coverUrl || "").trim();
        if (!coverUrl) return null;

        // Data URI support (common for cached images).
        const dataMatch = coverUrl.match(
          /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i,
        );
        if (dataMatch?.[1] && dataMatch?.[2]) {
          const mediaType = dataMatch[1].toLowerCase();
          if (mediaType === "image/webp") return null;
          const extension =
            mediaType === "image/png"
              ? "png"
              : mediaType === "image/jpeg"
                ? "jpg"
                : null;
          if (!extension) return null;
          return { base64: dataMatch[2], mediaType, extension };
        }

        if (!/^https?:\/\//i.test(coverUrl)) return null;
        const base = FileSystem.cacheDirectory || FileSystem.documentDirectory;
        if (!base) return null;

        let extension = "jpg";
        try {
          const u = new URL(coverUrl);
          const path = u.pathname || "";
          const ext = path.split(".").pop()?.toLowerCase();
          if (ext === "png") extension = "png";
          else if (ext === "jpg" || ext === "jpeg") extension = "jpg";
          else if (ext === "webp") return null;
        } catch {
          // ignore
        }

        const mediaType = extension === "png" ? "image/png" : "image/jpeg";
        const tmp = `${base}novelnest-epub-cover-${Date.now()}.${extension}`;

        try {
          await FileSystem.downloadAsync(coverUrl, tmp);
          const base64 = await FileSystem.readAsStringAsync(tmp, {
            encoding: FileSystem.EncodingType.Base64,
          });
          return { base64, mediaType, extension };
        } catch {
          return null;
        } finally {
          try {
            await FileSystem.deleteAsync(tmp, { idempotent: true });
          } catch {
            // ignore
          }
        }
      };

      const { base64, fileName, mimeType } =
        await EpubExportService.buildEpubBase64({
          uuid: `novelnest:${novel.pluginId}:${novel.id}`,
          title: novel.title || "Untitled",
          author: novel.author || "Unknown",
          language: settings.general.language || "en",
          subject: Array.isArray(novel.genres) ? novel.genres.join(", ") : "",
          description: novel.summary || "",
          chapters,
          cover: await getCoverImage(),
        });

      let uri: string | null = null;

      if (Platform.OS === "android" && FileSystem.StorageAccessFramework) {
        const perm =
          await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (perm.granted) {
          const targetUri =
            await FileSystem.StorageAccessFramework.createFileAsync(
              perm.directoryUri,
              fileName,
              mimeType,
            );
          await FileSystem.writeAsStringAsync(targetUri, base64, {
            encoding: FileSystem.EncodingType.Base64,
          });
          uri = targetUri;
        }
      }

      if (!uri) {
        const baseDir = FileSystem.documentDirectory;
        if (!baseDir) throw new Error("Missing document directory.");
        const path = `${baseDir}${fileName}`;
        await FileSystem.writeAsStringAsync(path, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        uri = path;
      }

      const canShare = await Sharing.isAvailableAsync();
      const isContentUri = String(uri).startsWith("content://");
      if (canShare && (Platform.OS !== "android" || !isContentUri)) {
        await Sharing.shareAsync(uri, {
          mimeType,
          dialogTitle: "Share EPUB",
        });
        return;
      }

      const warning =
        missingFiles > 0
          ? `\n\nNote: ${missingFiles} chapter file(s) were missing and skipped.`
          : "";
      Alert.alert("EPUB Exported", `Saved to:\n${uri}${warning}`);
    } catch (e: any) {
      Alert.alert(
        "Export Failed",
        e?.message || "Could not export EPUB. Please try again.",
      );
    } finally {
      AndroidProgressNotifications.clearTask("epubExport");
      setIsEpubExporting(false);
      setEpubExportProgress(null);
    }
  }, [
    isEpubExporting,
    novel,
    remoteChapters,
    settings.general.downloadLocation,
    settings.general.language,
  ]);

  const downloadOptions = [
    {
      id: "next",
      label: "Next chapter",
      icon: "arrow-down-circle-outline" as const,
      onPress: () => handleDownloadNext(1),
    },
    {
      id: "next5",
      label: "Next 5 chapters",
      icon: "arrow-down-circle-outline" as const,
      onPress: () => handleDownloadNext(5),
    },
    {
      id: "next10",
      label: "Next 10 chapters",
      icon: "arrow-down-circle-outline" as const,
      onPress: () => handleDownloadNext(10),
    },
    {
      id: "unread",
      label: "All unread",
      icon: "cloud-download-outline" as const,
      onPress: () => handleDownloadUnread(),
    },
    {
      id: "all",
      label: "All chapters",
      icon: "cloud-download-outline" as const,
      onPress: () => enqueueManyChapterDownloads(remoteChapters),
    },
    {
      id: "delete",
      label: "Delete downloads",
      icon: "trash-outline" as const,
      isDestructive: true,
      onPress: handleDeleteAllDownloads,
    },
  ];

  const trackerOptions = useMemo(
    () => trackers.map((tr) => ({ value: tr.id, label: tr.name })),
    [],
  );

  const handleStartTrackingLink = useCallback(() => {
    if (!novel) return;
    setIsTrackerPickerVisible(true);
  }, [novel]);

  const handlePickTracker = useCallback(
    async (value: string) => {
      const id = value as TrackerId;
      setTrackingTrackerId(id);
      try {
        await TrackingService.ensureValidAuth(id);
        setIsTrackingSearchVisible(true);
      } catch (e: any) {
        Alert.alert(
          "Tracker not connected",
          e?.message ||
            "Connect this tracker first in Settings â†’ Tracking Services.",
          [
            { text: "OK", style: "cancel" },
            {
              text: "Open settings",
              onPress: () => (navigation as any).navigate("TrackingServices"),
            },
          ],
        );
      }
    },
    [navigation],
  );

  const handleLinkTrackerResult = useCallback(
    (result: { id: string; title: string; coverImage?: string }) => {
      if (!novel) return;
      const base = novel.trackingLinks || {};
      updateNovel(novel.id, {
        trackingLinks: {
          ...base,
          [trackingTrackerId]: {
            trackerId: trackingTrackerId,
            remoteId: String(result.id),
            title: String(result.title),
            coverImage: result.coverImage,
          },
        },
      });
    },
    [novel, trackingTrackerId, updateNovel],
  );

  const handleSyncTracking = useCallback(async () => {
    if (!novel) return;
    const links = novel.trackingLinks || {};
    const linkList = Object.values(links);
    if (linkList.length === 0) {
      Alert.alert("Tracking", "No trackers linked for this novel.");
      return;
    }
    if (isTrackingSyncing) return;

    setIsTrackingSyncing(true);
    try {
      const total = Math.max(0, Math.floor(novel.totalChapters || 0));
      const read = Math.max(
        0,
        Math.min(total, total - Math.max(0, Math.floor(novel.unreadChapters || 0))),
      );
      const status = total > 0 && read >= total ? "COMPLETED" : "CURRENT";

      for (const link of linkList) {
        const auth = await TrackingService.ensureValidAuth(link.trackerId);
        const tracker = getTracker(link.trackerId);
        await tracker.updateUserListEntry(
          link.remoteId,
          { progress: read, status },
          auth,
        );
      }

      Alert.alert("Tracking", "Synced progress to linked trackers.");
    } catch (e: any) {
      Alert.alert("Tracking", e?.message || "Failed to sync tracking.");
    } finally {
      setIsTrackingSyncing(false);
    }
  }, [isTrackingSyncing, novel]);

  const moreOptions = [
    {
      id: "openWeb",
      label: "Open website",
      icon: "globe-outline" as const,
      onPress: handleWebView,
    },
    {
      id: "exportEpub",
      label: isEpubExporting ? "Exporting EPUB..." : "Export EPUB",
      icon: "download-outline" as const,
      onPress: handleExportEpub,
    },
    {
      id: "track",
      label: "Track...",
      icon: "sync-outline" as const,
      onPress: handleStartTrackingLink,
    },
    {
      id: "syncTrack",
      label: isTrackingSyncing ? "Syncing..." : "Sync tracking",
      icon: "cloud-upload-outline" as const,
      onPress: handleSyncTracking,
    },
    {
      id: "markRead",
      label: "Mark all read",
      icon: "checkmark-done-outline" as const,
      onPress: handleMarkRead,
    },
    {
      id: "markUnread",
      label: "Mark all unread",
      icon: "ellipse-outline" as const,
      onPress: handleMarkUnread,
    },
    {
      id: "editInfo",
      label: "Edit info",
      icon: "create-outline" as const,
      onPress: openEditInfo,
    },
    {
      id: "editCover",
      label: "Edit cover",
      icon: "image-outline" as const,
      onPress: handleEditCover,
    },
  ];

  const handleHeaderBackPress = useCallback(() => {
    if (isChapterSelectionMode) {
      clearChapterSelection();
      return;
    }
    if ((navigation as any).canGoBack?.()) (navigation as any).goBack();
    else (navigation as any).navigate("Main", { screen: "Library" });
  }, [clearChapterSelection, isChapterSelectionMode, navigation]);

  // â”€â”€ Render chapter item â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const renderChapterItem = useCallback(
    ({ item, index }: { item: PluginChapterItem; index: number }) => (
      <ChapterItem
        item={item}
        index={index}
        selected={selectedChapterPaths.has(item.path)}
        isRead={readStatusByPath.get(item.path) ?? false}
        downloadInfo={downloadTaskByPath.get(item.path)}
        isDownloaded={Boolean(novel?.chapterDownloaded?.[item.path])}
        isChapterSelectionMode={isChapterSelectionMode}
        theme={theme}
        toggleChapterSelected={toggleChapterSelected}
        handlePluginChapterPress={handlePluginChapterPress}
        enqueueChapterDownload={enqueueChapterDownload}
      />
    ),
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

  // â”€â”€ List header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const listHeader = useMemo(
    () => (
      <>
        {/* Hero */}
        <View style={styles.hero}>
          {!!displayCover && (
            <Image
              source={{ uri: displayCover }}
              style={StyleSheet.absoluteFill}
              blurRadius={20}
            />
          )}
          <View style={[StyleSheet.absoluteFill, styles.heroScrim]} />
          <View style={styles.heroContent}>
            <Image
              source={{ uri: displayCover }}
              style={[styles.cover, { width: coverWidth, height: coverHeight }]}
            />
            <View style={styles.heroMeta}>
              <Text style={styles.heroTitle} numberOfLines={3}>
                {displayTitle}
              </Text>
              <View style={styles.heroRow}>
                <Ionicons
                  name="person-outline"
                  size={13}
                  color="rgba(255,255,255,0.7)"
                />
                <Text style={styles.heroAuthor} numberOfLines={1}>
                  {" "}
                  {displayAuthor}
                </Text>
              </View>
              <View style={styles.heroBadges}>
                <View
                  style={[
                    styles.badge,
                    displayStatus === "completed"
                      ? styles.badgeComplete
                      : styles.badgeOngoing,
                  ]}
                >
                  <Ionicons
                    name={
                      displayStatus === "completed"
                        ? "checkmark-circle"
                        : "sync-outline"
                    }
                    size={11}
                    color="#FFF"
                  />
                  <Text style={styles.badgeText}> {displayStatus}</Text>
                </View>
                {!!novel?.source && (
                  <View style={[styles.badge, styles.badgeSource]}>
                    <Ionicons
                      name="cube-outline"
                      size={11}
                      color="rgba(255,255,255,0.85)"
                    />
                    <Text style={styles.badgeText} numberOfLines={1}>
                      {" "}
                      {novel.source}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Action row */}
        <View
          style={[
            styles.actionRow,
            {
              backgroundColor: theme.colors.surface,
              borderBottomColor: theme.colors.border,
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.actionBtn,
              isInLibrary
                ? { backgroundColor: theme.colors.primary }
                : {
                    backgroundColor: theme.colors.primary + "18",
                    borderWidth: 1,
                    borderColor: theme.colors.primary,
                  },
            ]}
            onPress={handleLibraryToggle}
            activeOpacity={0.8}
          >
            <Ionicons
              name={isInLibrary ? "heart" : "heart-outline"}
              size={17}
              color={isInLibrary ? "#FFF" : theme.colors.primary}
            />
            <Text
              style={[
                styles.actionBtnText,
                { color: isInLibrary ? "#FFF" : theme.colors.primary },
              ]}
            >
              {isInLibrary ? "In library" : "Add to library"}
            </Text>
          </TouchableOpacity>

          {remoteChapters.length > 0 && (
            <TouchableOpacity
              style={[
                styles.actionBtn,
                {
                  backgroundColor: theme.colors.success,
                  flex: 0,
                  paddingHorizontal: 16,
                },
              ]}
              onPress={handleProgressPress}
              activeOpacity={0.8}
            >
              <Ionicons name="play" size={15} color="#FFF" />
              <Text style={[styles.actionBtnText, { color: "#FFF" }]}>
                {effectiveReadCount > 0 ? "Resume" : "Start"}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.actionIconBtn,
              { backgroundColor: theme.colors.background },
            ]}
            onPress={handleWebView}
          >
            <Ionicons
              name="globe-outline"
              size={20}
              color={theme.colors.textSecondary}
            />
          </TouchableOpacity>
        </View>

        {/* Loading / error */}
        {isRemoteLoading && !remoteDetail && remoteChapters.length === 0 && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text
              style={[
                styles.loadingText,
                { color: theme.colors.textSecondary },
              ]}
            >
              Loading details...
            </Text>
          </View>
        )}
        {!!remoteError && (
          <View
            style={[
              styles.errorBanner,
              {
                backgroundColor: theme.colors.error + "18",
                borderColor: theme.colors.error + "40",
              },
            ]}
          >
            <Ionicons
              name="alert-circle-outline"
              size={16}
              color={theme.colors.error}
            />
            <Text
              style={[styles.errorBannerText, { color: theme.colors.error }]}
            >
              {remoteError}
            </Text>
          </View>
        )}

        {/* Summary */}
        {!!displaySummary && (
          <View
            style={[
              styles.section,
              { borderBottomColor: theme.colors.divider },
            ]}
          >
            <Text
              style={[
                styles.sectionLabel,
                { color: theme.colors.textSecondary },
              ]}
            >
              Synopsis
            </Text>
            <Text
              style={[styles.summaryText, { color: theme.colors.text }]}
              numberOfLines={summaryExpanded ? undefined : 4}
            >
              {displaySummary}
            </Text>
            {displaySummary.length > 200 && (
              <TouchableOpacity
                style={styles.expandBtn}
                onPress={() => setSummaryExpanded((v) => !v)}
              >
                <Text
                  style={[
                    styles.expandBtnText,
                    { color: theme.colors.primary },
                  ]}
                >
                  {summaryExpanded ? "Show less" : "Show more"}
                </Text>
                <Ionicons
                  name={summaryExpanded ? "chevron-up" : "chevron-down"}
                  size={14}
                  color={theme.colors.primary}
                />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Genres */}
        {displayGenres.length > 0 && (
          <View
            style={[
              styles.section,
              { borderBottomColor: theme.colors.divider },
            ]}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.genreScroll}
              contentContainerStyle={styles.genreList}
            >
              {displayGenres.map((genre) => (
                <TouchableOpacity
                  key={genre}
                  style={[
                    styles.genreChip,
                    {
                      backgroundColor: theme.colors.primary + "18",
                      borderColor: theme.colors.primary + "40",
                    },
                  ]}
                  onPress={() =>
                    (navigation as any).navigate("SourceDetail", { genre })
                  }
                >
                  <Text
                    style={[styles.genreText, { color: theme.colors.primary }]}
                  >
                    {genre}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Progress */}
        <TouchableOpacity
          style={[
            styles.progressSection,
            {
              backgroundColor: theme.colors.surface,
              borderBottomColor: theme.colors.divider,
            },
          ]}
          onPress={handleProgressPress}
          activeOpacity={0.75}
        >
          <View style={styles.progressTop}>
            <View style={styles.progressLeft}>
              <Ionicons
                name="library-outline"
                size={15}
                color={theme.colors.primary}
              />
              <Text
                style={[styles.progressLabel, { color: theme.colors.text }]}
              >
                {" "}
                Reading progress
              </Text>
            </View>
            <Text
              style={[styles.progressCount, { color: theme.colors.primary }]}
            >
              {effectiveReadCount} / {progressTotal}
            </Text>
          </View>
          <View
            style={[
              styles.progressTrack,
              { backgroundColor: theme.colors.border },
            ]}
          >
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor:
                    progressPercent >= 100
                      ? theme.colors.success
                      : theme.colors.primary,
                  width: `${progressPercent}%`,
                },
              ]}
            />
          </View>
          <View style={styles.progressBottom}>
            <Text
              style={[
                styles.progressSub,
                { color: theme.colors.textSecondary },
              ]}
            >
              {progressPercent >= 100
                ? "Completed âœ“"
                : `${Math.round(progressPercent)}% read`}
            </Text>
            <Text
              style={[
                styles.progressSub,
                { color: theme.colors.textSecondary },
              ]}
            >
              {progressTotal} chapters
            </Text>
          </View>
        </TouchableOpacity>

        {/* Chapters header bar */}
        <View
          style={[
            styles.chapterHeader,
            {
              backgroundColor: theme.colors.background,
              borderBottomColor: theme.colors.divider,
            },
          ]}
        >
          <Text
            style={[styles.chapterHeaderTitle, { color: theme.colors.text }]}
          >
            Chapters
            {remoteChapters.length > 0 && (
              <Text
                style={[
                  styles.chapterHeaderCount,
                  { color: theme.colors.textSecondary },
                ]}
              >
                {"  "}
                {remoteChapters.length}
              </Text>
            )}
          </Text>
          {chaptersHasMore && (
            <TouchableOpacity
              style={[
                styles.loadMoreInline,
                { borderColor: theme.colors.border },
              ]}
              onPress={loadMoreChapters}
              disabled={isChaptersLoadingMore}
            >
              {isChaptersLoadingMore ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <>
                  <Ionicons
                    name="add-circle-outline"
                    size={14}
                    color={theme.colors.primary}
                  />
                  <Text
                    style={[
                      styles.loadMoreInlineText,
                      { color: theme.colors.primary },
                    ]}
                  >
                    {" "}
                    Load more
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {(!novel?.pluginId || remoteChapters.length === 0) &&
          !isRemoteLoading && (
            <View style={styles.emptyChapters}>
              <Ionicons
                name="document-text-outline"
                size={36}
                color={theme.colors.textSecondary}
              />
              <Text
                style={[
                  styles.emptyChaptersText,
                  { color: theme.colors.textSecondary },
                ]}
              >
                No chapters available yet.
              </Text>
            </View>
          )}
      </>
    ),
    [
      chaptersHasMore,
      coverHeight,
      coverWidth,
      displayAuthor,
      displayCover,
      displayGenres,
      displayStatus,
      displaySummary,
      displayTitle,
      effectiveReadCount,
      handleLibraryToggle,
      handleProgressPress,
      handleWebView,
      isChaptersLoadingMore,
      isInLibrary,
      isRemoteLoading,
      loadMoreChapters,
      navigation,
      novel?.pluginId,
      novel?.source,
      progressPercent,
      progressTotal,
      remoteChapters.length,
      remoteDetail,
      remoteError,
      summaryExpanded,
      theme,
    ],
  );

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Header
        title={
          isChapterSelectionMode ? `${selectedChapterPaths.size} selected` : ""
        }
        onBackPress={handleHeaderBackPress}
        rightButtons={
          isChapterSelectionMode ? (
            <TouchableOpacity
              onPress={() => setIsChapterSelectionMenuVisible(true)}
              style={styles.iconBtn}
            >
              <Ionicons
                name="ellipsis-vertical"
                size={22}
                color={theme.colors.text}
              />
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                onPress={() => setIsDownloadMenuVisible(true)}
                style={styles.iconBtn}
              >
                <Ionicons
                  name={
                    novel?.isDownloaded
                      ? "cloud-download"
                      : "cloud-download-outline"
                  }
                  size={22}
                  color={
                    novel?.isDownloaded
                      ? theme.colors.success
                      : theme.colors.text
                  }
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setIsMoreMenuVisible(true)}
                style={styles.iconBtn}
              >
                <Ionicons
                  name="ellipsis-vertical"
                  size={22}
                  color={theme.colors.text}
                />
              </TouchableOpacity>
            </>
          )
        }
      />

      {!novel ? (
        <View style={styles.center}>
          <Ionicons
            name="alert-circle-outline"
            size={40}
            color={theme.colors.error}
          />
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
              <View style={styles.footerLoadMore}>
                <TouchableOpacity
                  style={[
                    styles.footerLoadMoreBtn,
                    {
                      backgroundColor: isChaptersLoadingMore
                        ? theme.colors.border
                        : theme.colors.primary,
                    },
                  ]}
                  disabled={isChaptersLoadingMore}
                  onPress={loadMoreChapters}
                >
                  {isChaptersLoadingMore ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={styles.footerLoadMoreText}>
                      Load more chapters
                    </Text>
                  )}
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

      <SelectionModal
        visible={isTrackerPickerVisible}
        title="Tracking service"
        options={trackerOptions}
        selectedValue={trackingTrackerId}
        onSelect={handlePickTracker}
        onClose={() => setIsTrackerPickerVisible(false)}
      />
      <TrackingSearchModal
        visible={isTrackingSearchVisible}
        trackerId={trackingTrackerId}
        initialQuery={novel?.title || ""}
        onSelect={handleLinkTrackerResult}
        onClose={() => setIsTrackingSearchVisible(false)}
      />

      <Modal
        visible={isEpubExporting}
        transparent
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={styles.exportOverlay}>
          <View
            style={[
              styles.exportCard,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.exportTitle, { color: theme.colors.text }]}>
              Exporting EPUB
            </Text>
            {epubExportProgress ? (
              <Text
                style={[
                  styles.exportSubtitle,
                  { color: theme.colors.textSecondary },
                ]}
              >
                {epubExportProgress.current}/{epubExportProgress.total}
              </Text>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* Category modal */}
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
              <Ionicons
                name="albums-outline"
                size={22}
                color={theme.colors.primary}
              />
              <View style={{ flex: 1 }}>
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
            </View>
            <View>
              {categoryChoices.map((c) => {
                const sel = pendingCategoryId === c.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[
                      styles.categoryRow,
                      { borderTopColor: theme.colors.divider },
                      sel && { backgroundColor: theme.colors.primary + "10" },
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
                      name={sel ? "checkmark-circle" : "ellipse-outline"}
                      size={22}
                      color={
                        sel ? theme.colors.primary : theme.colors.textSecondary
                      }
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                  },
                ]}
                onPress={() => setIsCategoryModalVisible(false)}
              >
                <Text
                  style={[styles.modalBtnText, { color: theme.colors.text }]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={!pendingCategoryId}
                style={[
                  styles.modalBtn,
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
                    styles.modalBtnText,
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

      {/* Edit info modal */}
      <Modal
        visible={isEditInfoModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsEditInfoModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsEditInfoModalVisible(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ width: "100%" }}
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
                <Ionicons
                  name="create-outline"
                  size={22}
                  color={theme.colors.primary}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                    Edit info
                  </Text>
                  <Text
                    style={[
                      styles.modalSubtitle,
                      { color: theme.colors.textSecondary },
                    ]}
                  >
                    Update title, author and summary.
                  </Text>
                </View>
              </View>

              <View style={styles.editForm}>
                <Text style={[styles.editLabel, { color: theme.colors.textSecondary }]}>
                  Title
                </Text>
                <TextInput
                  value={editTitle}
                  onChangeText={setEditTitle}
                  placeholder="Title"
                  placeholderTextColor={theme.colors.textSecondary}
                  style={[
                    styles.editInput,
                    { color: theme.colors.text, borderColor: theme.colors.border },
                  ]}
                />

                <Text style={[styles.editLabel, { color: theme.colors.textSecondary }]}>
                  Author
                </Text>
                <TextInput
                  value={editAuthor}
                  onChangeText={setEditAuthor}
                  placeholder="Author"
                  placeholderTextColor={theme.colors.textSecondary}
                  style={[
                    styles.editInput,
                    { color: theme.colors.text, borderColor: theme.colors.border },
                  ]}
                />

                <Text style={[styles.editLabel, { color: theme.colors.textSecondary }]}>
                  Summary
                </Text>
                <TextInput
                  value={editSummary}
                  onChangeText={setEditSummary}
                  placeholder="Summary"
                  placeholderTextColor={theme.colors.textSecondary}
                  multiline
                  style={[
                    styles.editTextarea,
                    { color: theme.colors.text, borderColor: theme.colors.border },
                  ]}
                />

                <View style={styles.editActions}>
                  <TouchableOpacity
                    onPress={() => setIsEditInfoModalVisible(false)}
                    style={[
                      styles.editBtn,
                      { backgroundColor: theme.colors.border },
                    ]}
                  >
                    <Text style={[styles.editBtnText, { color: theme.colors.text }]}>
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={saveEditInfo}
                    style={[
                      styles.editBtn,
                      { backgroundColor: theme.colors.primary },
                    ]}
                  >
                    <Text style={[styles.editBtnText, { color: "#FFF" }]}>
                      Save
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

// â”€â”€â”€ Styles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const styles = StyleSheet.create({
  container: { flex: 1 },
  iconBtn: { padding: 8 },
  listContent: { flexGrow: 1, paddingBottom: 32 },

  // Loading / error states
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    padding: 32,
  },
  errorText: { fontSize: 14, textAlign: "center" },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
  },
  loadingText: { fontSize: 13 },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    margin: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  errorBannerText: { fontSize: 13, flex: 1 },

  // Hero
  hero: { height: 220, overflow: "hidden" },
  heroScrim: { backgroundColor: "rgba(0,0,0,0.52)" },
  heroContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 16,
    gap: 14,
  },
  cover: { borderRadius: 10, backgroundColor: "#1a1a1a" },
  heroMeta: { flex: 1, paddingBottom: 4 },
  heroTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#FFF",
    marginBottom: 6,
    lineHeight: 24,
  },
  heroRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  heroAuthor: { fontSize: 13, color: "rgba(255,255,255,0.8)", flex: 1 },
  heroBadges: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: { color: "#FFF", fontSize: 11, fontWeight: "700" },
  badgeComplete: { backgroundColor: "#22c55e" },
  badgeOngoing: { backgroundColor: "#f59e0b" },
  badgeSource: { backgroundColor: "rgba(255,255,255,0.2)" },

  // Action row
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  actionBtnText: { fontSize: 14, fontWeight: "700" },
  actionIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },

  // Section
  section: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 8,
  },

  // Summary
  summaryText: { fontSize: 14, lineHeight: 22 },
  expandBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 3,
  },
  expandBtnText: { fontSize: 13, fontWeight: "600" },

  // Genres
  genreScroll: { marginHorizontal: -16 },
  genreList: { paddingHorizontal: 16, gap: 8 },
  genreChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  genreText: { fontSize: 12, fontWeight: "600" },

  // Progress
  progressSection: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  progressTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  progressLeft: { flexDirection: "row", alignItems: "center" },
  progressLabel: { fontSize: 14, fontWeight: "600" },
  progressCount: { fontSize: 14, fontWeight: "700" },
  progressTrack: { height: 5, borderRadius: 999, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 999 },
  progressBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  progressSub: { fontSize: 12 },

  // Chapter header bar
  chapterHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  chapterHeaderTitle: { fontSize: 15, fontWeight: "700" },
  chapterHeaderCount: { fontSize: 13, fontWeight: "400" },
  loadMoreInline: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  loadMoreInlineText: { fontSize: 12, fontWeight: "600" },

  // Empty chapters
  emptyChapters: { padding: 32, alignItems: "center", gap: 10 },
  emptyChaptersText: { fontSize: 14 },

  // Chapter row
  chapterRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingRight: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  chapterStripe: {
    width: 3,
    alignSelf: "stretch",
    borderRadius: 3,
    marginRight: 12,
  },
  chapterNumWrap: { width: 40, alignItems: "center" },
  chapterNum: { fontSize: 12, fontWeight: "700" },
  chapterMeta: { flex: 1, paddingRight: 8 },
  chapterTitle: { fontSize: 14, fontWeight: "600", lineHeight: 19 },
  chapterDate: { fontSize: 11, marginTop: 3 },
  dlBtn: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },

  // Footer load more
  footerLoadMore: { paddingHorizontal: 16, paddingVertical: 12 },
  footerLoadMoreBtn: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  footerLoadMoreText: { fontWeight: "700", color: "#FFF", fontSize: 14 },

  // Export modal
  exportOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  exportCard: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    alignItems: "center",
    gap: 10,
  },
  exportTitle: { fontSize: 16, fontWeight: "800", marginTop: 4 },
  exportSubtitle: { fontSize: 12, fontWeight: "700" },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 16,
  },
  modalTitle: { fontSize: 16, fontWeight: "800" },
  modalSubtitle: { fontSize: 12, marginTop: 2 },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  categoryLabel: { fontSize: 14, fontWeight: "600", flex: 1, paddingRight: 12 },
  modalActions: { flexDirection: "row", gap: 10, padding: 12 },
  modalBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
  },
  modalBtnText: { fontWeight: "800", fontSize: 14 },

  // Edit info
  editForm: { paddingHorizontal: 16, paddingBottom: 16, gap: 8 },
  editLabel: { fontSize: 11, fontWeight: "700", marginTop: 4 },
  editInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  editTextarea: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 110,
    textAlignVertical: "top",
  },
  editActions: { flexDirection: "row", gap: 10, marginTop: 8 },
  editBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  editBtnText: { fontWeight: "800", fontSize: 14 },
});
