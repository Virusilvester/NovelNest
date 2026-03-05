// src/screens/main/SourcesScreen.tsx
import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { useNavigation } from "@react-navigation/native";
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

  const handleSourcePress = (source: (typeof sources)[0]) => {
    navigation.navigate("SourceDetail", {
      sourceId: source.id,
      sourceName: source.name,
    });
  };

  const renderSource = ({ item }: { item: (typeof sources)[0] }) => (
    <TouchableOpacity
      style={[styles.sourceItem, { backgroundColor: theme.colors.surface }]}
      onPress={() => handleSourcePress(item)}
    >
      <View
        style={[styles.iconContainer, { backgroundColor: theme.colors.border }]}
      >
        {item.iconUrl ? (
          <Image source={{ uri: item.iconUrl }} style={styles.icon} />
        ) : (
          <Ionicons name="globe" size={32} color={theme.colors.textSecondary} />
        )}
      </View>
      <View style={styles.sourceInfo}>
        <Text style={[styles.sourceName, { color: theme.colors.text }]}>
          {item.name}
        </Text>
        <Text
          style={[
            styles.sourceStatus,
            {
              color: item.enabled ? theme.colors.success : theme.colors.error,
            },
          ]}
        >
          {item.enabled ? "Enabled" : "Disabled"} • {item.lang.toUpperCase()} •
          v{item.version}
        </Text>
      </View>
      <TouchableOpacity
        onPress={() => setExtensionPluginEnabled(item.id, !item.enabled)}
        style={styles.toggleButton}
      >
        <Ionicons
          name={item.enabled ? "checkmark-circle" : "close-circle"}
          size={24}
          color={item.enabled ? theme.colors.success : theme.colors.error}
        />
      </TouchableOpacity>
      <Ionicons
        name="chevron-forward"
        size={24}
        color={theme.colors.textSecondary}
      />
    </TouchableOpacity>
  );

  const filterMenuItems = [
    {
      id: "alphabetically",
      label: "Alphabetically",
      onPress: () => setSortOption("alphabetically"),
    },
    {
      id: "enabled",
      label: "Enabled",
      onPress: () => setSortOption("enabled"),
    },
  ];

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Header
        title="Sources"
        onMenuPress={() => navigation.openDrawer()}
        isSearchActive={isSearchActive}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={() => setIsSearchActive(true)}
        onSearchClose={() => {
          setIsSearchActive(false);
          setSearchQuery("");
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
              <TouchableOpacity
                onPress={() => setIsFilterMenuVisible(true)}
                style={styles.iconButton}
              >
                <Ionicons name="filter" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </>
          ) : null
        }
      />

      <FlashList
        data={sources}
        renderItem={renderSource}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
              No sources installed
            </Text>
            <Text
              style={[
                styles.emptySubtitle,
                { color: theme.colors.textSecondary },
              ]}
            >
              Install sources from Extensions, then enable them here.
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={Platform.OS === "android"}
      />

      <PopupMenu
        visible={isFilterMenuVisible}
        onClose={() => setIsFilterMenuVisible(false)}
        items={filterMenuItems.map((item) => ({
          ...item,
          onPress: () => {
            item.onPress();
            setIsFilterMenuVisible(false);
          },
        }))}
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
  listContent: {
    padding: 16,
  },
  emptyState: {
    padding: 24,
    alignItems: "center",
    gap: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: "center",
  },
  sourceItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    marginBottom: 8,
    borderRadius: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  sourceInfo: {
    flex: 1,
  },
  sourceName: {
    fontSize: 16,
    fontWeight: "bold",
  },
  sourceStatus: {
    fontSize: 12,
    marginTop: 4,
  },
  toggleButton: {
    padding: 8,
  },
});
