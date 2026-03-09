// src/screens/main/SourcesScreen.tsx
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { FlashList } from "@shopify/flash-list";
import React, { useMemo, useState } from "react";
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Header } from "../../components/common/Header";
import { PopupMenu } from "../../components/common/PopupMenu";
import { useSettings } from "../../context/SettingsContext";
import { useTheme } from "../../context/ThemeContext";
import type { MainDrawerNavigationProp } from "../../navigation/navigationTypes";

type SortOption = "alphabetically" | "enabled";

export const SourcesScreen: React.FC = () => {
  const navigation = useNavigation<MainDrawerNavigationProp>();
  const { theme } = useTheme();
  const { settings, setExtensionPluginEnabled } = useSettings();
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("alphabetically");
  const [isFilterMenuVisible, setIsFilterMenuVisible] = useState(false);

  const installed = useMemo(
    () => settings.extensions.installedPlugins || {},
    [settings.extensions.installedPlugins],
  );

  const sources = useMemo(() => {
    const all = Object.values(installed).map((p) => ({
      id: p.id,
      name: p.name,
      iconUrl: p.iconUrl,
      site: p.site,
      lang: p.lang,
      version: p.version,
      enabled: p.enabled,
    }));
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? all.filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            s.id.toLowerCase().includes(q) ||
            s.lang.toLowerCase().includes(q),
        )
      : all;
    return filtered.sort((a, b) => {
      if (sortOption === "enabled") {
        if (a.enabled === b.enabled) return a.name.localeCompare(b.name);
        return a.enabled ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  }, [installed, searchQuery, sortOption]);

  const renderSource = ({ item }: { item: (typeof sources)[0] }) => (
    <TouchableOpacity
      style={[styles.sourceCard, { backgroundColor: theme.colors.surface }]}
      onPress={() => navigation.navigate("SourceDetail", { sourceId: item.id, sourceName: item.name })}
      activeOpacity={0.8}
    >
      {/* Icon */}
      <View style={[styles.iconWrap, { backgroundColor: theme.colors.background }]}>
        {item.iconUrl ? (
          <Image source={{ uri: item.iconUrl }} style={styles.icon} />
        ) : (
          <Ionicons name="globe-outline" size={26} color={theme.colors.textSecondary} />
        )}
      </View>

      {/* Info */}
      <View style={styles.sourceInfo}>
        <Text style={[styles.sourceName, { color: theme.colors.text }]} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={styles.sourceMeta}>
          <View style={[styles.langBadge, { backgroundColor: theme.colors.primary + "1A" }]}>
            <Text style={[styles.langText, { color: theme.colors.primary }]}>
              {item.lang.toUpperCase()}
            </Text>
          </View>
          <Text style={[styles.versionText, { color: theme.colors.textSecondary }]}>
            v{item.version}
          </Text>
        </View>
      </View>

      {/* Status toggle */}
      <TouchableOpacity
        onPress={() => setExtensionPluginEnabled(item.id, !item.enabled)}
        style={[
          styles.toggleBtn,
          {
            backgroundColor: item.enabled
              ? (theme.colors.success + "1A")
              : (theme.colors.error + "1A"),
          },
        ]}
        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
      >
        <Ionicons
          name={item.enabled ? "checkmark-circle" : "close-circle"}
          size={20}
          color={item.enabled ? theme.colors.success : theme.colors.error}
        />
        <Text
          style={[
            styles.toggleText,
            { color: item.enabled ? theme.colors.success : theme.colors.error },
          ]}
        >
          {item.enabled ? "On" : "Off"}
        </Text>
      </TouchableOpacity>

      <Ionicons name="chevron-forward" size={16} color={theme.colors.textSecondary} />
    </TouchableOpacity>
  );

  const filterMenuItems = [
    { id: "alphabetically", label: "A → Z", onPress: () => { setSortOption("alphabetically"); setIsFilterMenuVisible(false); } },
    { id: "enabled", label: "Enabled first", onPress: () => { setSortOption("enabled"); setIsFilterMenuVisible(false); } },
  ];

  const sortLabel = sortOption === "enabled" ? "Enabled first" : "A → Z";

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Header
        title="Sources"
        onMenuPress={() => navigation.openDrawer()}
        isSearchActive={isSearchActive}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={() => setIsSearchActive(true)}
        onSearchClose={() => { setIsSearchActive(false); setSearchQuery(""); }}
        rightButtons={
          !isSearchActive ? (
            <>
              <TouchableOpacity onPress={() => setIsSearchActive(true)} style={styles.iconBtn}>
                <Ionicons name="search-outline" size={22} color={theme.colors.text} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setIsFilterMenuVisible(true)} style={styles.iconBtn}>
                <Ionicons name="funnel-outline" size={20} color={theme.colors.text} />
              </TouchableOpacity>
            </>
          ) : null
        }
      />

      {/* Summary bar */}
      {sources.length > 0 && (
        <View style={[styles.summaryBar, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <View style={styles.summaryLeft}>
            <Ionicons name="layers-outline" size={14} color={theme.colors.textSecondary} />
            <Text style={[styles.summaryText, { color: theme.colors.textSecondary }]}>
              {" "}{sources.length} source{sources.length !== 1 ? "s" : ""}
              {"  ·  "}
              {sources.filter((s) => s.enabled).length} enabled
            </Text>
          </View>
          <TouchableOpacity style={styles.sortBtn} onPress={() => setIsFilterMenuVisible(true)}>
            <Ionicons name="swap-vertical-outline" size={13} color={theme.colors.primary} />
            <Text style={[styles.sortBtnText, { color: theme.colors.primary }]}>
              {" "}{sortLabel}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <FlashList
        data={sources}
        renderItem={renderSource}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={Platform.OS === "android"}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconWrap, { backgroundColor: theme.colors.surface }]}>
              <Ionicons name="extension-puzzle-outline" size={48} color={theme.colors.textSecondary} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
              No sources installed
            </Text>
            <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
              Install sources from Extensions, then enable them here
            </Text>
          </View>
        }
      />

      <PopupMenu
        visible={isFilterMenuVisible}
        onClose={() => setIsFilterMenuVisible(false)}
        items={filterMenuItems}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  iconBtn: { padding: 8 },
  listContent: { padding: 16, paddingBottom: 28 },

  summaryBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  summaryLeft: { flexDirection: "row", alignItems: "center" },
  summaryText: { fontSize: 12 },
  sortBtn: { flexDirection: "row", alignItems: "center" },
  sortBtnText: { fontSize: 12, fontWeight: "600" },

  sourceCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    marginBottom: 10,
    borderRadius: 14,
    gap: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  icon: { width: 48, height: 48, borderRadius: 12 },
  sourceInfo: { flex: 1 },
  sourceName: { fontSize: 15, fontWeight: "700", marginBottom: 5 },
  sourceMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  langBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  langText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.4 },
  versionText: { fontSize: 12 },
  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 3,
  },
  toggleText: { fontSize: 12, fontWeight: "700" },

  emptyContainer: {
    paddingTop: 60,
    alignItems: "center",
    gap: 12,
  },
  emptyIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  emptyTitle: { fontSize: 18, fontWeight: "800" },
  emptySubtitle: { fontSize: 14, textAlign: "center", maxWidth: 280, lineHeight: 20 },
});