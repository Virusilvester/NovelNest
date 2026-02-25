import { Ionicons } from "@expo/vector-icons";
import type { RouteProp } from "@react-navigation/native";
import { useNavigation, useRoute } from "@react-navigation/native";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Header } from "../../components/common/Header";
import { PopupMenu } from "../../components/common/PopupMenu";
import { NovelGrid } from "../../components/library/NovelGrid";
import { useSettings } from "../../context/SettingsContext";
import { useTheme } from "../../context/ThemeContext";
import type { RootStackParamList } from "../../navigation/types";
import { PluginRuntimeService } from "../../services/pluginRuntime";
import type { Novel, SourceSortOption } from "../../types";

type SearchItem = { name: string; cover?: string; path: string };
const isSearchItem = (value: any): value is SearchItem =>
  value &&
  typeof value === "object" &&
  typeof value.name === "string" &&
  typeof value.path === "string";

export const SourceDetailScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, "SourceDetail">>();
  const { theme } = useTheme();
  const { settings } = useSettings();

  const { sourceId, sourceName, genre } = route.params;
  const headerTitle = sourceName || genre || "Source";

  const installed = settings.extensions.installedPlugins || {};
  const plugin = sourceId ? installed[sourceId] : undefined;

  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<SourceSortOption>("popular");
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [isMoreVisible, setIsMoreVisible] = useState(false);
  const [displayMode, setDisplayMode] = useState<"compactGrid" | "list">(
    "compactGrid",
  );

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SearchItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const pickBrowseFn = React.useCallback(
    (instance: any) => {
      if (
        sortOption === "latest" &&
        typeof instance.latestNovels === "function"
      ) {
        return (p: number) => instance.latestNovels(p);
      }
      if (typeof instance.popularNovels === "function") {
        return (p: number) => instance.popularNovels(p);
      }
      if (typeof instance.latestNovels === "function") {
        return (p: number) => instance.latestNovels(p);
      }
      if (typeof instance.searchNovels === "function") {
        return (p: number) => instance.searchNovels("", p);
      }
      return null;
    },
    [sortOption],
  );

  const loadPage = React.useCallback(async (
    opts: { pageNo: number; reset: boolean; query?: string },
  ) => {
    if (!plugin || !plugin.enabled) return;

    const q = (opts.query ?? searchQuery).trim();
    const isSearchMode = Boolean(q);

    try {
      if (opts.pageNo === 1 && opts.reset) setIsLoading(true);
      else setIsLoadingMore(true);
      setError(null);

      const instance = await PluginRuntimeService.loadLnReaderPlugin(plugin, {
        userAgent: settings.advanced.userAgent,
      });
      const anyInstance = instance as any;

      let raw: any[] | undefined;
      if (isSearchMode) {
        if (typeof anyInstance.searchNovels !== "function") {
          throw new Error("Plugin does not support search.");
        }
        raw = await anyInstance.searchNovels(q, opts.pageNo);
      } else {
        const fn = pickBrowseFn(anyInstance);
        if (!fn) {
          setError("This source does not support listing; use search.");
          return;
        }
        raw = await fn(opts.pageNo);
      }

      const items = Array.isArray(raw) ? raw.filter(isSearchItem) : [];
      setResults((prev) => (opts.reset ? items : [...prev, ...items]));
      setPage(opts.pageNo);

      const nextHasMore =
        (raw as any)?.__hasMore != null
          ? Boolean((raw as any).__hasMore)
          : items.length > 0;
      setHasMore(nextHasMore);
    } catch (e: any) {
      setError(e?.message || "Failed to load novels.");
      if (opts.reset) setResults([]);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [pickBrowseFn, plugin, searchQuery, settings.advanced.userAgent]);

  useEffect(() => {
    setResults([]);
    setError(null);
    setSearchQuery("");
    setIsSearchActive(false);
    setPage(1);
    setHasMore(true);
    if (!plugin || !plugin.enabled) return;
    // Auto-load a listing when opening a source
    const load = async () => {
      await loadPage({ pageNo: 1, reset: true, query: "" });
    };
    load();
  }, [loadPage, plugin]);

  const refresh = async () => {
    if (!plugin || !plugin.enabled) return;
    setPage(1);
    setHasMore(true);
    await loadPage({ pageNo: 1, reset: true });
  };

  const runSearch = async (q: string) => {
    if (!plugin) return;
    if (!plugin.enabled) {
      setError("This source is disabled. Enable it from Sources.");
      return;
    }
    const query = q.trim();
    if (!query) {
      setResults([]);
      setError(null);
      setPage(1);
      setHasMore(true);
      await loadPage({ pageNo: 1, reset: true, query: "" });
      return;
    }

    setPage(1);
    setHasMore(true);
    await loadPage({ pageNo: 1, reset: true, query });
  };

  const displayedResults = useMemo(() => {
    const items = [...results];
    switch (sortOption) {
      case "completed":
      case "latest":
      case "topRated":
      case "popular":
      default:
        items.sort((a, b) => a.name.localeCompare(b.name));
        return items;
    }
  }, [results, sortOption]);

  const displayedNovels: Novel[] = useMemo(() => {
    const sourceLabel = plugin?.name || headerTitle;
    return displayedResults.map((r) => ({
      id: r.path,
      title: r.name,
      author: "",
      coverUrl: r.cover || "https://via.placeholder.com/300x450",
      status: "ongoing",
      source: sourceLabel,
      summary: "",
      genres: [],
      totalChapters: 0,
      unreadChapters: 0,
      isDownloaded: false,
      isInLibrary: false,
      categoryId: "all",
    }));
  }, [displayedResults, headerTitle, plugin?.name]);

  const handleOpenWeb = () => {
    if (plugin?.site) navigation.navigate("WebView", { url: plugin.site });
  };

  const loadMore = async () => {
    if (!plugin || !plugin.enabled) return;
    if (!hasMore || isLoading || isLoadingMore) return;
    await loadPage({ pageNo: page + 1, reset: false });
  };

  const filterItems = [
    { id: "popular", label: "Popular", onPress: () => setSortOption("popular") },
    { id: "latest", label: "Latest", onPress: () => setSortOption("latest") },
    { id: "topRated", label: "Top Rated", onPress: () => setSortOption("topRated") },
    { id: "completed", label: "Completed", onPress: () => setSortOption("completed") },
  ];

  const moreItems = [
    {
      id: "displayMode",
      label: `Display: ${displayMode === "compactGrid" ? "Grid" : "List"}`,
      onPress: () => {
        setIsMoreVisible(false);
        setDisplayMode((prev) => (prev === "compactGrid" ? "list" : "compactGrid"));
      },
    },
    {
      id: "webView",
      label: "Open website",
      onPress: () => {
        setIsMoreVisible(false);
        handleOpenWeb();
      },
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Header
        title={headerTitle}
        onBackPress={() => navigation.goBack()}
        isSearchActive={isSearchActive}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={() => runSearch(searchQuery)}
        onSearchClose={() => {
          setIsSearchActive(false);
          setSearchQuery("");
          setResults([]);
          setError(null);
        }}
        rightButtons={
          !isSearchActive ? (
            <>
              <TouchableOpacity
                onPress={() => setIsSearchActive(true)}
                style={styles.iconButton}
              >
                <Ionicons name="search" size={24} color={theme.colors.text} />
              </TouchableOpacity>
              <TouchableOpacity onPress={refresh} style={styles.iconButton}>
                <Ionicons name="refresh" size={24} color={theme.colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setIsFilterVisible(true)}
                style={styles.iconButton}
              >
                <Ionicons name="filter" size={24} color={theme.colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setIsMoreVisible(true)}
                style={styles.iconButton}
              >
                <Ionicons name="ellipsis-vertical" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </>
          ) : null
        }
      />

      {!plugin ? (
        <View style={styles.banner}>
          <Text style={[styles.bannerText, { color: theme.colors.textSecondary }]}>
            This screen is meant for installed Sources. Install sources from Extensions.
          </Text>
        </View>
      ) : !plugin.enabled ? (
        <View style={styles.banner}>
          <Text style={[styles.bannerText, { color: theme.colors.warning }]}>
            Source is disabled. Enable it from Sources.
          </Text>
        </View>
      ) : null}

      {isLoading ? (
        <View style={styles.banner}>
          <ActivityIndicator />
        </View>
      ) : error ? (
        <View style={styles.banner}>
          <Text style={[styles.bannerText, { color: theme.colors.error }]}>
            {error}
          </Text>
        </View>
      ) : null}

      {displayedNovels.length === 0 ? (
        plugin?.enabled ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
              {error ? "No results" : "Browse or search"}
            </Text>
            <Text
              style={[
                styles.emptySubtitle,
                { color: theme.colors.textSecondary },
              ]}
            >
              {error
                ? error
                : "Pull to refresh for popular/latest. Or tap search to find a title."}
            </Text>
          </View>
        ) : null
      ) : (
        <NovelGrid
          novels={displayedNovels}
          displayMode={displayMode}
          showDownloadBadges={false}
          showUnreadBadges={false}
          refreshing={isLoading}
          onRefresh={refresh}
          onEndReached={loadMore}
          onEndReachedThreshold={0.7}
          ListFooterComponent={
            isLoadingMore ? (
              <View style={styles.footer}>
                <ActivityIndicator />
                <Text
                  style={[
                    styles.footerText,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  Loading more...
                </Text>
              </View>
            ) : null
          }
          onNovelPress={(novel) => {
            if (!sourceId) return;
            navigation.navigate("PluginNovelDetail", {
              pluginId: sourceId,
              novelPath: novel.id,
              novelName: novel.title,
              coverUrl: novel.coverUrl,
            });
          }}
        />
      )}

      <PopupMenu
        visible={isFilterVisible}
        onClose={() => setIsFilterVisible(false)}
        items={filterItems.map((item) => ({
          ...item,
          onPress: () => {
            item.onPress();
            setIsFilterVisible(false);
          },
        }))}
      />

      <PopupMenu
        visible={isMoreVisible}
        onClose={() => setIsMoreVisible(false)}
        items={moreItems.map((item) => ({
          ...item,
          onPress: () => item.onPress(),
        }))}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  iconButton: { padding: 8 },
  banner: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  bannerText: { fontSize: 13 },
  emptyState: { padding: 24, alignItems: "center", gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: "800" },
  emptySubtitle: { fontSize: 13, textAlign: "center" },
  footer: { paddingVertical: 18, alignItems: "center", gap: 8 },
  footerText: { fontSize: 12 },
});
