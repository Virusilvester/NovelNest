// src/screens/library/PluginNovelDetailScreen.tsx
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
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View
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
import type { RootStackParamList } from "../../navigation/types";
import { ChapterDownloads } from "../../services/chapterDownloads";
import { getTracker, trackers } from "../../services/tracking/registry";
import { TrackingService } from "../../services/tracking/TrackingService";
import {
  normalizePluginDetailForCache,
  NovelDetailCache,
} from "../../services/novelDetailCache";
import { PluginRuntimeService } from "../../services/pluginRuntime";
import type { Theme } from "../../theme";
import type { CachedPluginNovelDetail, Novel, TrackerId } from "../../types";
import {
  computeTotalEffectiveReadCount,
  detectChapterListOrder,
  getEffectiveReadForChapter,
  pickResumeChapter,
  updateReadOverridesForSelection,
} from "../../utils/chapterState";
import { clamp } from "../../utils/responsive";

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Chapter Row ──────────────────────────────────────────────────────────────

type ChapterRowProps = {
  chapter: ChapterItem;
  index: number;
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
    index,
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
      if (isSelectionMode) { onToggleSelected(chapter.path); return; }
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

    const dlIcon = (() => {
      if (isDownloaded) return { name: "checkmark-circle" as const, color: theme.colors.success };
      if (downloadStatus === "downloading") return null; // spinner
      if (downloadStatus === "pending") return { name: "time-outline" as const, color: theme.colors.textSecondary };
      if (downloadStatus === "error") return { name: "alert-circle-outline" as const, color: theme.colors.error };
      return { name: "arrow-down-circle-outline" as const, color: theme.colors.textSecondary };
    })();

    return (
      <TouchableOpacity
        style={[
          styles.chapterRow,
          selected && { backgroundColor: theme.colors.primary + "14" },
          { borderBottomColor: theme.colors.divider },
        ]}
        onPress={handlePress}
        onLongPress={handleLongPress}
        delayLongPress={380}
        activeOpacity={0.75}
      >
        {/* Read status stripe */}
        <View style={[
          styles.chapterStripe,
          { backgroundColor: isRead ? theme.colors.primary + "40" : "transparent" },
        ]} />

        {/* Selection checkbox or chapter number */}
        {isSelectionMode ? (
          <View style={styles.chapterCheckWrap}>
            <Ionicons
              name={selected ? "checkmark-circle" : "ellipse-outline"}
              size={22}
              color={selected ? theme.colors.primary : theme.colors.textSecondary}
            />
          </View>
        ) : (
          <View style={styles.chapterNumWrap}>
            <Text style={[styles.chapterNum, { color: isRead ? theme.colors.textSecondary : theme.colors.primary }]}>
              {chapter.chapterNumber ?? index + 1}
            </Text>
          </View>
        )}

        {/* Title & meta */}
        <View style={styles.chapterMeta}>
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
            <Text style={[styles.chapterDate, { color: theme.colors.textSecondary }]} numberOfLines={1}>
              {chapter.releaseTime}
            </Text>
          )}
        </View>

        {/* Download button */}
        {!isSelectionMode && (
          <TouchableOpacity
            onPress={handleDownloadPress}
            style={styles.dlBtn}
            hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
          >
            {downloadStatus === "downloading" ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : dlIcon ? (
              <Ionicons name={dlIcon.name} size={20} color={dlIcon.color} />
            ) : null}
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  },
  (prev, next) =>
    prev.chapter === next.chapter &&
    prev.index === next.index &&
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

// ─── Main Screen ──────────────────────────────────────────────────────────────

export const PluginNovelDetailScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, "PluginNovelDetail">>();
  const { theme } = useTheme();
  const { settings } = useSettings();
  const { novels, addNovel, updateNovel, categories } = useLibrary();
  const { historyEntries, upsertHistoryEntry } = useHistory();
  const { tasks: downloadTasks, enqueue, cancelTask, cancelNovelTasks } = useDownloadQueue();
  const { width: SW } = useWindowDimensions();

  const coverWidth = clamp(Math.round(Math.min(SW * 0.28, 160)), 96, 160);
  const coverHeight = Math.round(coverWidth * 1.5);

  const { pluginId, novelPath, novelName, coverUrl } = route.params;

  // ── Stable ID ───────────────────────────────────────────────────────────────
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
  useEffect(() => { existingNovelRef.current = existingNovel || undefined; }, [existingNovel]);

  const installed = settings.extensions.installedPlugins || {};
  const plugin = installed[pluginId];

  const cacheKey = useMemo(() => NovelDetailCache.key(pluginId, novelPath), [pluginId, novelPath]);
  const fetchSignature = useMemo(() => NovelDetailCache.signature({
    novelId: stableNumericId, pluginId, novelPath,
    pluginVersion: plugin?.version, pluginUrl: plugin?.url,
    pluginLocalPath: plugin?.localPath, userAgent: settings.advanced.userAgent,
  }), [novelPath, plugin?.localPath, plugin?.url, plugin?.version, pluginId, settings.advanced.userAgent, stableNumericId]);

  const initialCached = useMemo((): CachedPluginNovelDetail | undefined => {
    const persisted = existingNovel?.pluginCache;
    const mem = NovelDetailCache.get(cacheKey);
    if (!mem) return persisted;
    if (!persisted) return mem;
    return (mem.cachedAt ?? 0) >= (persisted.cachedAt ?? 0) ? mem : persisted;
  }, [cacheKey, existingNovel?.pluginCache]);

  const [isLoading, setIsLoading] = useState(() => !initialCached);
  const [error, setError] = useState<string | null>(null);
  const [remoteDetail, setRemoteDetail] = useState<any>(() => initialCached?.detail ?? null);
  const [remoteChapters, setRemoteChapters] = useState<ChapterItem[]>(
    () => (Array.isArray(initialCached?.chapters) ? initialCached!.chapters : []),
  );
  const [isDownloadMenuVisible, setIsDownloadMenuVisible] = useState(false);
  const [isMoreMenuVisible, setIsMoreMenuVisible] = useState(false);
  const [isTrackerPickerVisible, setIsTrackerPickerVisible] = useState(false);
  const [isTrackingSearchVisible, setIsTrackingSearchVisible] = useState(false);
  const [trackingTrackerId, setTrackingTrackerId] =
    useState<TrackerId>("anilist");
  const [isTrackingSyncing, setIsTrackingSyncing] = useState(false);
  const [chaptersPage, setChaptersPage] = useState(() => initialCached?.chaptersPage ?? 1);
  const [chaptersHasMore, setChaptersHasMore] = useState(() => initialCached?.chaptersHasMore ?? false);
  const [isChaptersLoadingMore, setIsChaptersLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false);
  const [pendingCategoryId, setPendingCategoryId] = useState<string | null>(null);
  const [selectedChapterPaths, setSelectedChapterPaths] = useState<Set<string>>(() => new Set());
  const [isChapterSelectionMenuVisible, setIsChapterSelectionMenuVisible] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(false);

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

  // ── Data fetch ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const token = ++loadTokenRef.current;
    if (persistTimeoutRef.current) { clearTimeout(persistTimeoutRef.current); persistTimeoutRef.current = null; }
    const isStale = () => token !== loadTokenRef.current;
    const yieldToMain = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

    const run = async () => {
      const mem = NovelDetailCache.get(cacheKey);
      const persisted = existingNovel?.pluginCache;
      const cached = mem && persisted
        ? (mem.cachedAt ?? 0) >= (persisted.cachedAt ?? 0) ? mem : persisted
        : mem ?? persisted;

      if (cached && cached !== mem) NovelDetailCache.set(cacheKey, cached);
      const hasCachedChapters = Array.isArray(cached?.chapters) && cached.chapters.length > 0;

      if (cached) {
        if (isStale()) return;
        setError(null); setRemoteDetail(cached.detail);
        setRemoteChapters(Array.isArray(cached.chapters) ? cached.chapters : []);
        setChaptersPage(cached.chaptersPage); setChaptersHasMore(cached.chaptersHasMore);
        setIsLoading(false);
        if (cached.signature === fetchSignature) return;
        await yieldToMain();
        if (isStale()) return;
      }

      if (!plugin) { if (!cached) { setError("Plugin not installed."); setIsLoading(false); } return; }

      try {
        if (!cached) setIsLoading(true);
        setError(null);
        if (!cached) { setChaptersPage(1); setChaptersHasMore(false); }
        const instance = await PluginRuntimeService.loadLnReaderPlugin(plugin, { userAgent: settings.advanced.userAgent });
        const parseNovel = instance.parseNovelAndChapters || instance.parseNovel;
        if (!parseNovel) throw new Error("This plugin does not support novel details.");
        const data = await (parseNovel as any).call(instance, novelPath);
        if (isStale()) return;

        const normalizedDetail = normalizePluginDetailForCache(data);
        setRemoteDetail(normalizedDetail);
        const totalFromDetail = normalizedDetail?.totalChapters;
        const rawChapters = Array.isArray(data?.chapters) ? data.chapters : [];
        const chaptersMapped: ChapterItem[] = [];
        const streamChapters = !hasCachedChapters;
        if (streamChapters) { setIsLoading(false); setRemoteChapters([]); await yieldToMain(); if (isStale()) return; }

        const CHUNK = 2000;
        for (let start = 0; start < rawChapters.length; start += CHUNK) {
          if (isStale()) return;
          const chunk: ChapterItem[] = [];
          for (let i = start; i < Math.min(rawChapters.length, start + CHUNK); i++) {
            const c = rawChapters[i];
            if (!isChapterItem(c)) continue;
            chunk.push({ name: c.name, path: c.path, releaseTime: (c as any)?.releaseTime ?? null, chapterNumber: typeof (c as any)?.chapterNumber === "number" ? (c as any).chapterNumber : undefined });
          }
          if (chunk.length) { chaptersMapped.push(...chunk); if (streamChapters) setRemoteChapters((prev) => prev.concat(chunk)); }
          if (start + CHUNK < rawChapters.length) await yieldToMain();
        }
        if (isStale()) return;
        if (!streamChapters) setRemoteChapters(chaptersMapped);

        const hasMore = (typeof (instance as any).fetchChaptersPage === "function") &&
          (totalFromDetail != null ? chaptersMapped.length < totalFromDetail : false);
        setChaptersPage(1); setChaptersHasMore(hasMore);

        const cacheEntry: CachedPluginNovelDetail = { signature: fetchSignature, cachedAt: Date.now(), detail: normalizedDetail, chapters: chaptersMapped, chaptersPage: 1, chaptersHasMore: hasMore };
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
        if (!cached) setError(e?.message || "Failed to load novel details.");
      } finally { setIsLoading(false); }
    };
    void run();
    return () => { loadTokenRef.current += 1; if (persistTimeoutRef.current) { clearTimeout(persistTimeoutRef.current); persistTimeoutRef.current = null; } };
  }, [cacheKey, existingNovel?.pluginCache, fetchSignature, novelPath, plugin, settings.advanced.userAgent, updateNovel]);

  useEffect(() => {
    if (!plugin?.url?.startsWith("novelnest-api|")) return;
    const total = typeof remoteDetail?.totalChapters === "number" ? remoteDetail.totalChapters : undefined;
    if (total == null) return;
    setChaptersHasMore(chapters.length < total);
  }, [chapters.length, plugin?.url, remoteDetail?.totalChapters]);

  // ── More actions ─────────────────────────────────────────────────────────────
  const loadMoreChapters = useCallback(async () => {
    if (!plugin || !chaptersHasMore || isLoading || isChaptersLoadingMore) return;
    try {
      setIsChaptersLoadingMore(true);
      const instance = await PluginRuntimeService.loadLnReaderPlugin(plugin, { userAgent: settings.advanced.userAgent });
      if (typeof (instance as any).fetchChaptersPage !== "function") { setChaptersHasMore(false); return; }
      const nextPage = chaptersPage + 1;
      const res = await (instance as any).fetchChaptersPage(novelPath, nextPage);
      const raw = Array.isArray(res?.chapters) ? res.chapters : [];
      const mapped = raw.filter(isChapterItem);
      const appliedPage = typeof res?.page === "number" ? res.page : nextPage;
      const explicitHasMore = typeof res?.hasMore === "boolean" ? res.hasMore : undefined;
      const seen = new Set(remoteChapters.map((c) => c.path));
      const next = [...remoteChapters];
      for (const c of mapped) { if (!seen.has(c.path)) next.push(c); }
      const totalFromDetail = typeof remoteDetail?.totalChapters === "number" ? remoteDetail.totalChapters : undefined;
      const nextHasMore = typeof explicitHasMore === "boolean" ? explicitHasMore : totalFromDetail != null ? next.length < totalFromDetail : mapped.length > 0;
      setRemoteChapters(next); setChaptersPage(appliedPage); setChaptersHasMore(nextHasMore);
      const cacheEntry: CachedPluginNovelDetail = { signature: fetchSignature, cachedAt: Date.now(), detail: remoteDetail ?? NovelDetailCache.get(cacheKey)?.detail ?? null, chapters: next, chaptersPage: appliedPage, chaptersHasMore: nextHasMore };
      NovelDetailCache.set(cacheKey, cacheEntry);
      updateNovel(stableNumericId, { pluginCache: cacheEntry });
    } catch { /* ignore */ } finally { setIsChaptersLoadingMore(false); }
  }, [plugin, chaptersHasMore, isLoading, isChaptersLoadingMore, settings.advanced.userAgent, chaptersPage, novelPath, remoteChapters, remoteDetail, fetchSignature, cacheKey, stableNumericId, updateNovel]);

  const handleRefresh = useCallback(async () => {
    if (!plugin) return;
    setIsRefreshing(true);
    try {
      NovelDetailCache.clear(cacheKey);
      setError(null); setChaptersPage(1);
      const instance = await PluginRuntimeService.loadLnReaderPlugin(plugin, { userAgent: settings.advanced.userAgent });
      const parseNovel = (instance as any).parseNovelAndChapters || (instance as any).parseNovel;
      if (typeof parseNovel !== "function") throw new Error("Source does not support novel details.");
      const data = await parseNovel(novelPath);
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
        .filter(isChapterItem);
      setRemoteChapters(chaptersMapped); setChaptersPage(1);
      const totalFromDetail = normalizedDetail?.totalChapters;
      const canPage = typeof (instance as any).fetchChaptersPage === "function";
      setChaptersHasMore(canPage && (totalFromDetail != null ? chaptersMapped.length < totalFromDetail : false));
      const signature = NovelDetailCache.signature({ novelId: stableNumericId, pluginId: plugin.id, novelPath, pluginVersion: plugin.version, pluginUrl: plugin.url, pluginLocalPath: plugin.localPath, userAgent: settings.advanced.userAgent });
      const cacheEntry: CachedPluginNovelDetail = { signature, cachedAt: Date.now(), detail: normalizedDetail, chapters: chaptersMapped, chaptersPage: 1, chaptersHasMore: canPage && (totalFromDetail != null ? chaptersMapped.length < totalFromDetail : false) };
      NovelDetailCache.set(cacheKey, cacheEntry);
      if (existingNovel) updateNovel(existingNovel.id, { pluginCache: cacheEntry });
    } catch (e: any) { setError(e?.message || "Failed to refresh."); }
    finally { setIsRefreshing(false); }
  }, [plugin, cacheKey, novelPath, settings.advanced.userAgent, existingNovel, updateNovel, stableNumericId]);

  // ── Library ──────────────────────────────────────────────────────────────────
  const [isInLibrary, setIsInLibrary] = useState(Boolean(existingNovel?.isInLibrary));
  useEffect(() => { setIsInLibrary(Boolean(existingNovel?.isInLibrary)); }, [existingNovel?.isInLibrary]);

  const normalizedStatus: Novel["status"] = useMemo(() => {
    const s = String(status || "").toLowerCase();
    return (s.includes("complete") || s.includes("end") || s.includes("finished")) ? "completed" : "ongoing";
  }, [status]);

  const buildLibraryNovel = useCallback((nextInLibrary: boolean): Novel => {
    const totalChapters = typeof remoteDetail?.totalChapters === "number" ? remoteDetail.totalChapters : chapters.length || existingNovel?.totalChapters || 0;
    const lastReadChapter = existingNovel?.lastReadChapter || 0;
    const unreadChapters = existingNovel?.unreadChapters ?? Math.max(0, totalChapters - lastReadChapter);
    const pluginCache = NovelDetailCache.get(cacheKey) ?? existingNovel?.pluginCache;
    return { id: stableNumericId, title, author: author || "Unknown", coverUrl: cover || "https://via.placeholder.com/300x450", status: normalizedStatus, source: plugin?.name || pluginId, summary: summary || "", genres, totalChapters, unreadChapters: Math.min(unreadChapters, totalChapters), lastReadChapter, lastReadDate: existingNovel?.lastReadDate, isDownloaded: existingNovel?.isDownloaded ?? false, isInLibrary: nextInLibrary, categoryId: existingNovel?.categoryId || "reading", pluginId, pluginNovelPath: novelPath, pluginCache };
  }, [author, cacheKey, chapters.length, cover, existingNovel, genres, normalizedStatus, novelPath, plugin?.name, pluginId, remoteDetail?.totalChapters, stableNumericId, summary, title]);

  const categoryChoices = useMemo(() => {
    const list = Array.isArray(categories) ? categories : [];
    return list.filter((c) => c && c.id && c.id !== "all").slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [categories]);

  useEffect(() => {
    if (!isCategoryModalVisible) return;
    if (pendingCategoryId) return;
    const existing = existingNovel?.categoryId;
    setPendingCategoryId((existing && categoryChoices.some((c) => c.id === existing) && existing) || categoryChoices[0]?.id || null);
  }, [categoryChoices, existingNovel?.categoryId, isCategoryModalVisible, pendingCategoryId]);

  const upsertLibraryNovel = useCallback((nextInLibrary: boolean, categoryId?: string) => {
    const base = buildLibraryNovel(nextInLibrary);
    const withCategory = categoryId ? { ...base, categoryId } : base;
    if (!existingNovel) { addNovel({ ...withCategory, isInLibrary: true }); return; }
    updateNovel(stableNumericId, withCategory);
  }, [addNovel, buildLibraryNovel, existingNovel, stableNumericId, updateNovel]);

  const handleLibraryToggle = useCallback(() => {
    setIsInLibrary((prev) => { const next = !prev; upsertLibraryNovel(next); return next; });
  }, [upsertLibraryNovel]);

  const handleAddToLibrary = useCallback(() => {
    if (isInLibrary) return;
    if (categoryChoices.length === 0) { setIsInLibrary(true); upsertLibraryNovel(true); return; }
    if (categoryChoices.length === 1) { setIsInLibrary(true); upsertLibraryNovel(true, categoryChoices[0].id); return; }
    setPendingCategoryId(null); setIsCategoryModalVisible(true);
  }, [categoryChoices, isInLibrary, upsertLibraryNovel]);

  const handleWebView = useCallback(() => {
    const url = remoteDetail?.url || plugin?.site || plugin?.url || "";
    if (url) (navigation as any).navigate("WebView", { url });
  }, [navigation, plugin?.site, plugin?.url, remoteDetail?.url]);

  // ── Progress / reading ───────────────────────────────────────────────────────
  const chaptersTotal = chapters.length;
  const progressTotal = (existingNovel?.totalChapters && existingNovel.totalChapters > 0 ? existingNovel.totalChapters : chaptersTotal) || chaptersTotal;
  const chapterListOrder = useMemo(() => detectChapterListOrder(chapters), [chapters]);
  const baseReadCount = useMemo(() => {
    if (!existingNovel) return 0;
    return Math.max(0, Math.min(progressTotal, Math.floor(existingNovel.lastReadChapter || 0)));
  }, [existingNovel, progressTotal]);
  const effectiveReadCount = useMemo(() => {
    if (!existingNovel) return 0;
    if (chapters.length !== progressTotal) return baseReadCount;
    return computeTotalEffectiveReadCount({
      total: progressTotal,
      baseReadCount,
      order: chapterListOrder,
      chapters,
      readOverrides: existingNovel.chapterReadOverrides,
    });
  }, [baseReadCount, chapterListOrder, chapters, existingNovel, progressTotal]);
  const progressPercent = progressTotal > 0 ? (effectiveReadCount / progressTotal) * 100 : 0;

  const historyEntry = useMemo(
    () => historyEntries.find((e) => e.id === existingNovel?.id),
    [existingNovel?.id, historyEntries],
  );

  const resumeTarget = useMemo(() => {
    if (!existingNovel || chapters.length === 0) return null;
    return pickResumeChapter({
      chapters,
      order: chapterListOrder,
      baseReadCount: Math.min(baseReadCount, chapters.length),
      readOverrides: existingNovel.chapterReadOverrides,
      lastReadPath: historyEntry?.lastReadChapter?.id,
    });
  }, [
    baseReadCount,
    chapterListOrder,
    chapters,
    existingNovel,
    historyEntry?.lastReadChapter?.id,
  ]);
  const downloadTaskByPath = useMemo(() => {
    const map = new Map<string, { id: string; status: string }>();
    for (const task of downloadTasks) {
      if (task.pluginId !== pluginId) continue;
      if (task.novelId !== stableNumericId) continue;
      if (task.status === "pending" || task.status === "downloading" || task.status === "error") map.set(task.chapterPath, { id: task.id, status: task.status });
    }
    return map;
  }, [downloadTasks, pluginId, stableNumericId]);

  const chapterDownloaded = existingNovel?.chapterDownloaded;

  // ── Download handlers ────────────────────────────────────────────────────────
  const enqueueChapterDownload = useCallback((chapter: ChapterItem) => {
    if (!chapter?.path) return;
    if (!existingNovel) { Alert.alert("Not in library", "Add this novel to your library to download chapters."); return; }
    enqueue({ pluginId, pluginName: plugin?.name || pluginId, novelId: existingNovel.id, novelTitle: existingNovel.title, chapterPath: chapter.path, chapterTitle: chapter.name });
  }, [existingNovel, enqueue, plugin?.name, pluginId]);

  const enqueueManyChapterDownloads = useCallback((items: ChapterItem[]) => {
    if (!existingNovel) { Alert.alert("Not in library", "Add this novel to your library to download chapters."); return; }
    if (!Array.isArray(items) || items.length === 0) return;
    enqueue(items.map((c) => ({ pluginId, pluginName: plugin?.name || pluginId, novelId: existingNovel.id, novelTitle: existingNovel.title, chapterPath: c.path, chapterTitle: c.name })));
  }, [enqueue, existingNovel, plugin?.name, pluginId]);

  const handleDownloadUnread = useCallback((limit?: number) => {
    if (!existingNovel) { Alert.alert("Not in library", "Add this novel to your library to download chapters."); return; }
    if (chapters.length === 0) return;
    const unread = chapters.filter(
      (c, index) =>
        !getEffectiveReadForChapter({
          chapterPath: c.path,
          index,
          total: chapters.length,
          baseReadCount: Math.min(baseReadCount, chapters.length),
          order: chapterListOrder,
          readOverrides: existingNovel.chapterReadOverrides,
        }),
    );
    enqueueManyChapterDownloads(typeof limit === "number" ? unread.slice(0, limit) : unread);
  }, [baseReadCount, chapterListOrder, chapters, enqueueManyChapterDownloads, existingNovel]);

  const handleDeleteAllDownloads = useCallback(() => {
    if (!existingNovel) { Alert.alert("Not in library", "Add this novel to your library to manage downloads."); return; }
    const downloaded = existingNovelRef.current?.chapterDownloaded || {};
    const paths = Object.keys(downloaded);
    if (paths.length === 0) return;
    Alert.alert("Delete downloads", `Delete ${paths.length} downloaded chapter${paths.length === 1 ? "" : "s"}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => {
        void (async () => {
          cancelNovelTasks(existingNovel.id);
          await Promise.all(paths.map((p) => ChapterDownloads.deleteChapterHtml(pluginId, existingNovel.id, p, settings.general.downloadLocation)));
          updateNovel(existingNovel.id, { chapterDownloaded: undefined, isDownloaded: false });
        })();
      }},
    ]);
  }, [cancelNovelTasks, existingNovel, pluginId, settings.general.downloadLocation, updateNovel]);

  const downloadOptions = [
    { id: "next", label: "Next chapter", icon: "arrow-down-circle-outline" as const, onPress: () => handleDownloadUnread(1) },
    { id: "next5", label: "Next 5 chapters", icon: "arrow-down-circle-outline" as const, onPress: () => handleDownloadUnread(5) },
    { id: "next10", label: "Next 10 chapters", icon: "arrow-down-circle-outline" as const, onPress: () => handleDownloadUnread(10) },
    { id: "unread", label: "All unread", icon: "cloud-download-outline" as const, onPress: () => handleDownloadUnread() },
    { id: "all", label: "All chapters", icon: "cloud-download-outline" as const, onPress: () => enqueueManyChapterDownloads(chapters) },
    { id: "delete", label: "Delete downloads", icon: "trash-outline" as const, isDestructive: true, onPress: handleDeleteAllDownloads },
  ];

  const handleMarkRead = () => {
    if (!existingNovel) return;
    const total = existingNovel.totalChapters > 0 ? existingNovel.totalChapters : chapters.length;
    const now = new Date();
    updateNovel(existingNovel.id, {
      unreadChapters: 0,
      lastReadChapter: total,
      lastReadDate: now,
      chapterReadOverrides: undefined,
    });

    if (chapters.length > 0) {
      const last =
        pickResumeChapter({
          chapters,
          order: chapterListOrder,
          baseReadCount: chapters.length,
          readOverrides: undefined,
          lastReadPath: null,
        })?.chapter ?? chapters[0];

      upsertHistoryEntry({
        id: existingNovel.id,
        novel: { ...existingNovel, pluginCache: undefined } as any,
        lastReadChapter: {
          id: last.path,
          novelId: existingNovel.id,
          title: last.name || "Chapter",
          number: Math.max(1, chapters.length),
          isRead: true,
          isDownloaded: Boolean(existingNovel?.chapterDownloaded?.[last.path]),
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
    if (!existingNovel) return;
    const total = existingNovel.totalChapters > 0 ? existingNovel.totalChapters : chapters.length;
    const now = new Date();
    updateNovel(existingNovel.id, {
      unreadChapters: total,
      lastReadChapter: 0,
      lastReadDate: undefined,
      chapterReadOverrides: undefined,
    });

    if (chapters.length > 0) {
      const first =
        pickResumeChapter({
          chapters,
          order: chapterListOrder,
          baseReadCount: 0,
          readOverrides: undefined,
          lastReadPath: null,
        })?.chapter ?? chapters[0];

      upsertHistoryEntry({
        id: existingNovel.id,
        novel: { ...existingNovel, pluginCache: undefined } as any,
        lastReadChapter: {
          id: first.path,
          novelId: existingNovel.id,
          title: first.name || "Chapter",
          number: 1,
          isRead: false,
          isDownloaded: Boolean(existingNovel?.chapterDownloaded?.[first.path]),
          releaseDate: now,
        },
        progress: 0,
        totalChaptersRead: 0,
        lastReadDate: now,
        timeSpentReading: historyEntry?.timeSpentReading || 0,
      });
    }
  };

  const trackerOptions = useMemo(
    () => trackers.map((tr) => ({ value: tr.id, label: tr.name })),
    [],
  );

  const handleStartTrackingLink = useCallback(() => {
    if (!existingNovel) {
      Alert.alert("Not in library", "Add this novel to your library to track.");
      return;
    }
    setIsTrackerPickerVisible(true);
  }, [existingNovel]);

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
            "Connect this tracker first in Settings → Tracking Services.",
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
      if (!existingNovel) return;
      const base = existingNovel.trackingLinks || {};
      updateNovel(existingNovel.id, {
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
    [existingNovel, trackingTrackerId, updateNovel],
  );

  const handleSyncTracking = useCallback(async () => {
    if (!existingNovel) {
      Alert.alert("Not in library", "Add this novel to your library to track.");
      return;
    }
    const links = existingNovel.trackingLinks || {};
    const linkList = Object.values(links);
    if (linkList.length === 0) {
      Alert.alert("Tracking", "No trackers linked for this novel.");
      return;
    }
    if (isTrackingSyncing) return;

    setIsTrackingSyncing(true);
    try {
      const total = Math.max(0, Math.floor(existingNovel.totalChapters || 0));
      const read = Math.max(
        0,
        Math.min(
          total,
          total - Math.max(0, Math.floor(existingNovel.unreadChapters || 0)),
        ),
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
  }, [existingNovel, isTrackingSyncing]);

  const moreOptions = [
    { id: "openWeb", label: "Open website", icon: "globe-outline" as const, onPress: handleWebView },
    ...(existingNovel ? [
      { id: "track", label: "Track...", icon: "sync-outline" as const, onPress: handleStartTrackingLink },
      { id: "syncTrack", label: isTrackingSyncing ? "Syncing..." : "Sync tracking", icon: "cloud-upload-outline" as const, onPress: handleSyncTracking },
      { id: "markRead", label: "Mark all read", icon: "checkmark-done-outline" as const, onPress: handleMarkRead },
      { id: "markUnread", label: "Mark all unread", icon: "ellipse-outline" as const, onPress: handleMarkUnread },
    ] : []),
  ];

  // ── Chapter selection ────────────────────────────────────────────────────────
  const clearChapterSelection = useCallback(() => { setIsChapterSelectionMenuVisible(false); setSelectedChapterPaths(new Set()); }, []);
  const toggleChapterSelected = useCallback((path: string) => {
    setSelectedChapterPaths((prev) => { const next = new Set(prev); if (next.has(path)) next.delete(path); else next.add(path); return next; });
  }, []);
  const selectAllChapters = useCallback(() => { if (chapters.length === 0) return; setSelectedChapterPaths(new Set(chapters.map((c) => c.path))); }, [chapters]);
  const invertChapterSelection = useCallback(() => {
    if (chapters.length === 0) return;
    setSelectedChapterPaths((prev) => { const next = new Set<string>(); for (const c of chapters) { if (!prev.has(c.path)) next.add(c.path); } return next; });
  }, [chapters]);

  const markSelectedChaptersRead = useCallback(() => {
    if (!existingNovel) { Alert.alert("Not in library", "Add this novel to your library to track progress."); return; }
    if (selectedChapterPaths.size === 0) return;
    const now = new Date();
    if (chapters.length > 0 && selectedChapterPaths.size === chapters.length) {
      updateNovel(existingNovel.id, {
        unreadChapters: 0,
        lastReadChapter: progressTotal,
        lastReadDate: now,
        chapterReadOverrides: undefined,
      });
      const last =
        pickResumeChapter({
          chapters,
          order: chapterListOrder,
          baseReadCount: chapters.length,
          readOverrides: undefined,
          lastReadPath: null,
        })?.chapter ?? chapters[0];
      upsertHistoryEntry({
        id: existingNovel.id,
        novel: { ...existingNovel, pluginCache: undefined } as any,
        lastReadChapter: {
          id: last.path,
          novelId: existingNovel.id,
          title: last.name || "Chapter",
          number: Math.max(1, chapters.length),
          isRead: true,
          isDownloaded: Boolean(existingNovel?.chapterDownloaded?.[last.path]),
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
    const nextOverrides = updateReadOverridesForSelection({ total: progressTotal, baseReadCount, order: chapterListOrder, chapters, selectedPaths: selectedChapterPaths, readOverrides: existingNovel.chapterReadOverrides, markAs: "read" });
    const nextReadCount = computeTotalEffectiveReadCount({ total: progressTotal, baseReadCount, order: chapterListOrder, chapters, readOverrides: nextOverrides });
    updateNovel(existingNovel.id, {
      unreadChapters: Math.max(0, progressTotal - nextReadCount),
      lastReadDate: now,
      chapterReadOverrides: nextOverrides,
    });

    const resume = pickResumeChapter({
      chapters,
      order: chapterListOrder,
      baseReadCount: Math.min(baseReadCount, chapters.length),
      readOverrides: nextOverrides,
      lastReadPath: historyEntry?.lastReadChapter?.id,
    });
    const target = resume?.chapter ?? chapters[0];
    const isRead = getEffectiveReadForChapter({
      chapterPath: target.path,
      index: resume?.index ?? 0,
      total: chapters.length,
      baseReadCount: Math.min(baseReadCount, chapters.length),
      order: chapterListOrder,
      readOverrides: nextOverrides,
    });

    upsertHistoryEntry({
      id: existingNovel.id,
      novel: { ...existingNovel, pluginCache: undefined } as any,
      lastReadChapter: {
        id: target.path,
        novelId: existingNovel.id,
        title: target.name || "Chapter",
        number: (resume?.index ?? 0) + 1,
        isRead,
        isDownloaded: Boolean(existingNovel?.chapterDownloaded?.[target.path]),
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
    chapters,
    clearChapterSelection,
    existingNovel,
    historyEntry?.lastReadChapter?.id,
    historyEntry?.timeSpentReading,
    progressTotal,
    selectedChapterPaths,
    updateNovel,
    upsertHistoryEntry,
  ]);

  const markSelectedChaptersUnread = useCallback(() => {
    if (!existingNovel) { Alert.alert("Not in library", "Add this novel to your library to track progress."); return; }
    if (selectedChapterPaths.size === 0) return;
    const now = new Date();
    if (chapters.length > 0 && selectedChapterPaths.size === chapters.length) {
      updateNovel(existingNovel.id, {
        unreadChapters: progressTotal,
        lastReadChapter: 0,
        lastReadDate: undefined,
        chapterReadOverrides: undefined,
      });
      const first =
        pickResumeChapter({
          chapters,
          order: chapterListOrder,
          baseReadCount: 0,
          readOverrides: undefined,
          lastReadPath: null,
        })?.chapter ?? chapters[0];
      upsertHistoryEntry({
        id: existingNovel.id,
        novel: { ...existingNovel, pluginCache: undefined } as any,
        lastReadChapter: {
          id: first.path,
          novelId: existingNovel.id,
          title: first.name || "Chapter",
          number: 1,
          isRead: false,
          isDownloaded: Boolean(existingNovel?.chapterDownloaded?.[first.path]),
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
    const nextOverrides = updateReadOverridesForSelection({ total: progressTotal, baseReadCount, order: chapterListOrder, chapters, selectedPaths: selectedChapterPaths, readOverrides: existingNovel.chapterReadOverrides, markAs: "unread" });
    const nextReadCount = computeTotalEffectiveReadCount({ total: progressTotal, baseReadCount, order: chapterListOrder, chapters, readOverrides: nextOverrides });
    updateNovel(existingNovel.id, { unreadChapters: Math.max(0, progressTotal - nextReadCount), lastReadDate: nextReadCount === 0 ? undefined : existingNovel.lastReadDate, chapterReadOverrides: nextOverrides });

    const resume = pickResumeChapter({
      chapters,
      order: chapterListOrder,
      baseReadCount: Math.min(baseReadCount, chapters.length),
      readOverrides: nextOverrides,
      lastReadPath: historyEntry?.lastReadChapter?.id,
    });
    const target = resume?.chapter ?? chapters[0];
    const isRead = getEffectiveReadForChapter({
      chapterPath: target.path,
      index: resume?.index ?? 0,
      total: chapters.length,
      baseReadCount: Math.min(baseReadCount, chapters.length),
      order: chapterListOrder,
      readOverrides: nextOverrides,
    });

    upsertHistoryEntry({
      id: existingNovel.id,
      novel: { ...existingNovel, pluginCache: undefined } as any,
      lastReadChapter: {
        id: target.path,
        novelId: existingNovel.id,
        title: target.name || "Chapter",
        number: (resume?.index ?? 0) + 1,
        isRead,
        isDownloaded: Boolean(existingNovel?.chapterDownloaded?.[target.path]),
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
    chapters,
    clearChapterSelection,
    existingNovel,
    historyEntry?.lastReadChapter?.id,
    historyEntry?.timeSpentReading,
    progressTotal,
    selectedChapterPaths,
    updateNovel,
    upsertHistoryEntry,
  ]);

  const deleteSelectedChapterDownloads = useCallback(() => {
    if (!existingNovel) { Alert.alert("Not in library", "Add novel to library to manage downloads."); return; }
    const count = selectedChapterPaths.size;
    if (count === 0) return;
    Alert.alert("Delete downloads", `Delete ${count} downloaded chapter${count === 1 ? "" : "s"}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => {
        void (async () => {
          const novelId = existingNovel.id;
          const paths = Array.from(selectedChapterPaths);
          for (const task of downloadTasks) {
            if (task.pluginId !== pluginId || task.novelId !== novelId || !selectedChapterPaths.has(task.chapterPath)) continue;
            if (task.status === "pending" || task.status === "downloading") cancelTask(task.id);
          }
          await Promise.all(paths.map((p) => ChapterDownloads.deleteChapterHtml(pluginId, novelId, p, settings.general.downloadLocation)));
          const current = existingNovelRef.current;
          const base = current?.chapterDownloaded || {};
          const next = { ...base };
          for (const p of paths) delete next[p];
          const keys = Object.keys(next);
          updateNovel(novelId, { chapterDownloaded: keys.length ? next : undefined, isDownloaded: keys.length > 0 });
          clearChapterSelection();
        })();
      }},
    ]);
  }, [cancelTask, clearChapterSelection, downloadTasks, existingNovel, pluginId, selectedChapterPaths, settings.general.downloadLocation, updateNovel]);

  const chapterSelectionMenuItems = useMemo(() => [
    { id: "selectAll", label: "Select all", icon: "checkmark-circle-outline" as const, onPress: selectAllChapters },
    { id: "invert", label: "Invert selection", icon: "swap-horizontal-outline" as const, onPress: invertChapterSelection },
    { id: "read", label: "Mark as read", icon: "checkmark-done-outline" as const, onPress: markSelectedChaptersRead },
    { id: "unread", label: "Mark as unread", icon: "ellipse-outline" as const, onPress: markSelectedChaptersUnread },
    { id: "delete", label: "Delete downloads", icon: "trash-outline" as const, isDestructive: true, onPress: deleteSelectedChapterDownloads },
  ], [deleteSelectedChapterDownloads, invertChapterSelection, markSelectedChaptersRead, markSelectedChaptersUnread, selectAllChapters]);

  const openChapter = useCallback((chapter: ChapterItem) => {
    if (existingNovel) { (navigation as any).navigate("Reader", { novelId: stableNumericId, chapterId: chapter.path }); return; }
    (navigation as any).navigate("PluginReader", { pluginId, novelId: stableNumericId, novelPath, chapterPath: chapter.path, chapterTitle: chapter.name });
  }, [existingNovel, navigation, novelPath, pluginId, stableNumericId]);

  const handleProgressPress = useCallback(() => {
    if (chapters.length === 0) return;
    const target = resumeTarget?.chapter ?? chapters[0];
    if (target) openChapter(target);
  }, [chapters, openChapter, resumeTarget]);

  const handleHeaderBackPress = useCallback(() => {
    if (isChapterSelectionMode) { clearChapterSelection(); return; }
    loadTokenRef.current += 1;
    if (persistTimeoutRef.current) { clearTimeout(persistTimeoutRef.current); persistTimeoutRef.current = null; }
    if (navigation.canGoBack()) navigation.goBack();
    else (navigation as any).navigate("Main", { screen: "Sources" });
  }, [clearChapterSelection, isChapterSelectionMode, navigation]);

  // ── Render chapter item ──────────────────────────────────────────────────────
  const renderChapterItem = useCallback<ListRenderItem<ChapterItem>>(
    ({ item, index }) => {
      const selected = selectedChapterPaths.has(item.path);
      const isRead = existingNovel ? getEffectiveReadForChapter({ chapterPath: item.path, index, total: progressTotal, baseReadCount, order: chapterListOrder, readOverrides: existingNovel.chapterReadOverrides }) : false;
      const downloadInfo = downloadTaskByPath.get(item.path);
      const isDownloaded = Boolean(chapterDownloaded?.[item.path]);
      return (
        <ChapterRow
          chapter={item} index={index} theme={theme}
          isSelectionMode={isChapterSelectionMode} selected={selected}
          isRead={isRead} isInLibrary={Boolean(existingNovel)}
          isDownloaded={isDownloaded} downloadStatus={downloadInfo?.status}
          onToggleSelected={toggleChapterSelected} onOpenChapter={openChapter}
          onEnqueueDownload={enqueueChapterDownload}
        />
      );
    },
    [baseReadCount, chapterListOrder, chapterDownloaded, downloadTaskByPath, enqueueChapterDownload, existingNovel, isChapterSelectionMode, openChapter, progressTotal, selectedChapterPaths, theme, toggleChapterSelected],
  );

  // ── List header ──────────────────────────────────────────────────────────────
  const listHeader = useMemo(() => (
    <>
      {/* Hero: blurred cover + details overlay */}
      <View style={styles.hero}>
        {/* Blurred background */}
        {!!cover && (
          <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} blurRadius={18} />
        )}
        <View style={[StyleSheet.absoluteFill, styles.heroScrim]} />

        <View style={styles.heroContent}>
          {/* Cover art */}
          <Image
            source={{ uri: cover || "https://via.placeholder.com/300x450" }}
            style={[styles.cover, { width: coverWidth, height: coverHeight }]}
          />

          {/* Meta */}
          <View style={styles.heroMeta}>
            <Text style={styles.heroTitle} numberOfLines={3}>{title}</Text>

            {!!author && (
              <View style={styles.heroRow}>
                <Ionicons name="person-outline" size={13} color="rgba(255,255,255,0.7)" />
                <Text style={styles.heroAuthor} numberOfLines={1}>{" "}{author}</Text>
              </View>
            )}

            <View style={styles.heroBadges}>
              <View style={[styles.badge, normalizedStatus === "completed" ? styles.badgeComplete : styles.badgeOngoing]}>
                <Ionicons name={normalizedStatus === "completed" ? "checkmark-circle" : "sync-outline"} size={11} color="#FFF" />
                <Text style={styles.badgeText}>{" "}{normalizedStatus}</Text>
              </View>
              <View style={[styles.badge, styles.badgeSource]}>
                <Ionicons name="cube-outline" size={11} color="rgba(255,255,255,0.85)" />
                <Text style={styles.badgeText} numberOfLines={1}>{" "}{plugin?.name || pluginId}</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* Action row */}
      <View style={[styles.actionRow, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity
          style={[styles.actionBtn, isInLibrary ? { backgroundColor: theme.colors.primary } : { backgroundColor: theme.colors.primary + "18", borderWidth: 1, borderColor: theme.colors.primary }]}
          onPress={isInLibrary ? handleLibraryToggle : handleAddToLibrary}
          activeOpacity={0.8}
        >
          <Ionicons name={isInLibrary ? "heart" : "heart-outline"} size={17} color={isInLibrary ? "#FFF" : theme.colors.primary} />
          <Text style={[styles.actionBtnText, { color: isInLibrary ? "#FFF" : theme.colors.primary }]}>
            {isInLibrary ? "In library" : "Add to library"}
          </Text>
        </TouchableOpacity>

        {chapters.length > 0 && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: theme.colors.success, flex: 0, paddingHorizontal: 16 }]}
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
          style={[styles.actionIconBtn, { backgroundColor: theme.colors.background }]}
          onPress={handleWebView}
        >
          <Ionicons name="globe-outline" size={20} color={theme.colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Summary */}
      {!!summary && (
        <View style={[styles.section, { borderBottomColor: theme.colors.divider }]}>
          <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>Synopsis</Text>
          <Text
            style={[styles.summaryText, { color: theme.colors.text }]}
            numberOfLines={summaryExpanded ? undefined : 4}
          >
            {summary}
          </Text>
          {summary.length > 200 && (
            <TouchableOpacity style={styles.expandBtn} onPress={() => setSummaryExpanded((v) => !v)}>
              <Text style={[styles.expandBtnText, { color: theme.colors.primary }]}>
                {summaryExpanded ? "Show less" : "Show more"}
              </Text>
              <Ionicons name={summaryExpanded ? "chevron-up" : "chevron-down"} size={14} color={theme.colors.primary} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Genres */}
      {genres.length > 0 && (
        <View style={[styles.section, { borderBottomColor: theme.colors.divider }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.genreScroll} contentContainerStyle={styles.genreList}>
            {genres.map((g) => (
              <View key={g} style={[styles.genreChip, { backgroundColor: theme.colors.primary + "18", borderColor: theme.colors.primary + "40" }]}>
                <Text style={[styles.genreText, { color: theme.colors.primary }]}>{g}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Progress */}
      {existingNovel && (
        <TouchableOpacity
          style={[styles.progressSection, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.divider }]}
          onPress={handleProgressPress}
          disabled={chapters.length === 0}
          activeOpacity={0.75}
        >
          <View style={styles.progressTop}>
            <View style={styles.progressLeft}>
              <Ionicons name="library-outline" size={15} color={theme.colors.primary} />
              <Text style={[styles.progressLabel, { color: theme.colors.text }]}> Reading progress</Text>
            </View>
            <Text style={[styles.progressCount, { color: theme.colors.primary }]}>
              {effectiveReadCount} / {progressTotal}
            </Text>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: theme.colors.border }]}>
            <View style={[styles.progressFill, { backgroundColor: theme.colors.primary, width: `${progressPercent}%` }]} />
          </View>
          <View style={styles.progressBottom}>
            <Text style={[styles.progressSub, { color: theme.colors.textSecondary }]}>
              {progressPercent >= 100 ? "Completed" : `${Math.round(progressPercent)}% read`}
            </Text>
            <Text style={[styles.progressSub, { color: theme.colors.textSecondary }]}>
              {progressTotal} chapters
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Chapter list header bar */}
      <View style={[styles.chapterHeader, { backgroundColor: theme.colors.background, borderBottomColor: theme.colors.divider }]}>
        <Text style={[styles.chapterHeaderTitle, { color: theme.colors.text }]}>
          Chapters
          {chapters.length > 0 && (
            <Text style={[styles.chapterHeaderCount, { color: theme.colors.textSecondary }]}>
              {"  "}{chapters.length}
            </Text>
          )}
        </Text>
        {chaptersHasMore && (
          <TouchableOpacity
            style={[styles.loadMoreInline, { borderColor: theme.colors.border }]}
            onPress={loadMoreChapters}
            disabled={isChaptersLoadingMore}
          >
            {isChaptersLoadingMore
              ? <ActivityIndicator size="small" color={theme.colors.primary} />
              : <><Ionicons name="add-circle-outline" size={14} color={theme.colors.primary} /><Text style={[styles.loadMoreInlineText, { color: theme.colors.primary }]}> Load more</Text></>
            }
          </TouchableOpacity>
        )}
      </View>
    </>
  ), [
    author, chapters.length, chaptersHasMore, cover, coverHeight, coverWidth, effectiveReadCount,
    existingNovel, genres, handleAddToLibrary, handleLibraryToggle, handleProgressPress,
    handleWebView, isChaptersLoadingMore, isInLibrary, loadMoreChapters, normalizedStatus,
    plugin?.name, pluginId, progressPercent, progressTotal, summary, summaryExpanded,
    theme, title,
  ]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Header
        title={isChapterSelectionMode ? `${selectedChapterPaths.size} selected` : ""}
        onBackPress={handleHeaderBackPress}
        rightButtons={
          isChapterSelectionMode ? (
            <TouchableOpacity onPress={() => setIsChapterSelectionMenuVisible(true)} style={styles.iconBtn}>
              <Ionicons name="ellipsis-vertical" size={22} color={theme.colors.text} />
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity onPress={() => setIsDownloadMenuVisible(true)} style={styles.iconBtn}>
                <Ionicons name="cloud-download-outline" size={22} color={theme.colors.text} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setIsMoreMenuVisible(true)} style={styles.iconBtn}>
                <Ionicons name="ellipsis-vertical" size={22} color={theme.colors.text} />
              </TouchableOpacity>
            </>
          )
        }
      />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.centerText, { color: theme.colors.textSecondary }]}>Loading novel details…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={40} color={theme.colors.error} />
          <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
          <TouchableOpacity style={[styles.retryBtn, { backgroundColor: theme.colors.primary }]} onPress={handleRefresh}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
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
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={theme.colors.primary} colors={[theme.colors.primary]} />}
        />
      )}

      <PopupMenu visible={isDownloadMenuVisible} onClose={() => setIsDownloadMenuVisible(false)} items={downloadOptions} />
      <PopupMenu visible={isChapterSelectionMenuVisible} onClose={() => setIsChapterSelectionMenuVisible(false)} items={chapterSelectionMenuItems} />
      <PopupMenu visible={isMoreMenuVisible} onClose={() => setIsMoreMenuVisible(false)} items={moreOptions} />

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
        initialQuery={existingNovel?.title || novelName || ""}
        onSelect={handleLinkTrackerResult}
        onClose={() => setIsTrackingSearchVisible(false)}
      />

      {/* Category modal */}
      <Modal visible={isCategoryModalVisible} transparent animationType="fade" onRequestClose={() => setIsCategoryModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setIsCategoryModalVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={[styles.modalCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Ionicons name="albums-outline" size={22} color={theme.colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Add to category</Text>
                <Text style={[styles.modalSubtitle, { color: theme.colors.textSecondary }]}>Choose a category, then tap Add.</Text>
              </View>
            </View>
            <View style={styles.modalList}>
              {categoryChoices.map((c) => {
                const sel = pendingCategoryId === c.id;
                return (
                  <TouchableOpacity key={c.id} style={[styles.categoryRow, { borderTopColor: theme.colors.divider }, sel && { backgroundColor: theme.colors.primary + "10" }]} onPress={() => setPendingCategoryId(c.id)}>
                    <Text style={[styles.categoryLabel, { color: theme.colors.text }]}>{c.name}</Text>
                    <Ionicons name={sel ? "checkmark-circle" : "ellipse-outline"} size={22} color={sel ? theme.colors.primary : theme.colors.textSecondary} />
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]} onPress={() => setIsCategoryModalVisible(false)}>
                <Text style={[styles.modalBtnText, { color: theme.colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity disabled={!pendingCategoryId} style={[styles.modalBtn, { backgroundColor: pendingCategoryId ? theme.colors.primary : theme.colors.border, borderColor: "transparent" }]} onPress={() => { if (!pendingCategoryId) return; setIsInLibrary(true); upsertLibraryNovel(true, pendingCategoryId); setIsCategoryModalVisible(false); }}>
                <Text style={[styles.modalBtnText, { color: pendingCategoryId ? "#FFF" : theme.colors.textSecondary }]}>Add</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  iconBtn: { padding: 8 },
  listContent: { paddingBottom: 32 },

  // Loading / error
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32, gap: 12 },
  centerText: { fontSize: 14 },
  errorText: { fontSize: 14, textAlign: "center" },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10, marginTop: 4 },
  retryBtnText: { color: "#FFF", fontWeight: "700", fontSize: 14 },

  // Hero
  hero: { height: 220, overflow: "hidden", position: "relative" },
  heroScrim: { backgroundColor: "rgba(0,0,0,0.55)" },
  heroContent: { flex: 1, flexDirection: "row", alignItems: "flex-end", padding: 16, gap: 14 },
  cover: { borderRadius: 10, backgroundColor: "#1a1a1a" },
  heroMeta: { flex: 1, paddingBottom: 4 },
  heroTitle: { fontSize: 19, fontWeight: "800", color: "#FFF", marginBottom: 6, lineHeight: 24 },
  heroRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  heroAuthor: { fontSize: 13, color: "rgba(255,255,255,0.8)", flex: 1 },
  heroBadges: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  badge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { color: "#FFF", fontSize: 11, fontWeight: "700" },
  badgeComplete: { backgroundColor: "#22c55e" },
  badgeOngoing: { backgroundColor: "#f59e0b" },
  badgeSource: { backgroundColor: "rgba(255,255,255,0.2)" },

  // Action row
  actionRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 10, borderRadius: 10, gap: 6 },
  actionBtnText: { fontSize: 14, fontWeight: "700" },
  actionIconBtn: { width: 42, height: 42, borderRadius: 10, justifyContent: "center", alignItems: "center" },

  // Section
  section: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  sectionLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 },

  // Summary
  summaryText: { fontSize: 14, lineHeight: 22 },
  expandBtn: { flexDirection: "row", alignItems: "center", marginTop: 8, gap: 3 },
  expandBtnText: { fontSize: 13, fontWeight: "600" },

  // Genres
  genreScroll: { marginHorizontal: -16 },
  genreList: { paddingHorizontal: 16, gap: 8 },
  genreChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  genreText: { fontSize: 12, fontWeight: "600" },

  // Progress
  progressSection: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  progressTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  progressLeft: { flexDirection: "row", alignItems: "center" },
  progressLabel: { fontSize: 14, fontWeight: "600" },
  progressCount: { fontSize: 14, fontWeight: "700" },
  progressTrack: { height: 5, borderRadius: 999, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 999 },
  progressBottom: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  progressSub: { fontSize: 12 },

  // Chapter header bar
  chapterHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  chapterHeaderTitle: { fontSize: 15, fontWeight: "700" },
  chapterHeaderCount: { fontSize: 13, fontWeight: "400" },
  loadMoreInline: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  loadMoreInlineText: { fontSize: 12, fontWeight: "600" },

  // Chapter row
  chapterRow: { flexDirection: "row", alignItems: "center", paddingVertical: 13, paddingRight: 14, paddingLeft: 0, borderBottomWidth: StyleSheet.hairlineWidth },
  chapterStripe: { width: 3, alignSelf: "stretch", borderRadius: 3, marginRight: 12 },
  chapterCheckWrap: { width: 40, alignItems: "center" },
  chapterNumWrap: { width: 40, alignItems: "center" },
  chapterNum: { fontSize: 12, fontWeight: "700" },
  chapterMeta: { flex: 1, paddingRight: 8 },
  chapterTitle: { fontSize: 14, fontWeight: "600", lineHeight: 19 },
  chapterDate: { fontSize: 11, marginTop: 3 },
  dlBtn: { width: 32, height: 32, justifyContent: "center", alignItems: "center" },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", padding: 20 },
  modalCard: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  modalHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 16 },
  modalTitle: { fontSize: 16, fontWeight: "800" },
  modalSubtitle: { fontSize: 12, marginTop: 2 },
  modalList: {},
  categoryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 13, borderTopWidth: StyleSheet.hairlineWidth },
  categoryLabel: { fontSize: 14, fontWeight: "600", flex: 1, paddingRight: 12 },
  modalActions: { flexDirection: "row", gap: 10, padding: 12 },
  modalBtn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: "center", borderWidth: 1 },
  modalBtnText: { fontWeight: "800", fontSize: 14 },
});
