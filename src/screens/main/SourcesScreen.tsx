// src/screens/main/SourcesScreen.tsx
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React, { useState } from "react";
import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Header } from "../../components/common/Header";
import { PopupMenu } from "../../components/common/PopupMenu";
import { useTheme } from "../../context/ThemeContext";
import type { MainDrawerNavigationProp } from "../../navigation/navigationTypes";
import { Source } from "../../types";

// Mock data
const sources: Source[] = [
  {
    id: "1",
    name: "Novel Updates",
    iconUrl: "",
    isEnabled: true,
    supportsSearch: true,
    supportsFilters: true,
  },
  {
    id: "2",
    name: "Royal Road",
    iconUrl: "",
    isEnabled: true,
    supportsSearch: true,
    supportsFilters: true,
  },
];

type SortOption = "alphabetically" | "enabled";

export const SourcesScreen: React.FC = () => {
  const navigation = useNavigation<MainDrawerNavigationProp>();
  const { theme } = useTheme();
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("alphabetically");
  const [isFilterMenuVisible, setIsFilterMenuVisible] = useState(false);

  const filteredSources = sources.sort((a, b) => {
    if (sortOption === "enabled") {
      if (a.isEnabled === b.isEnabled) return a.name.localeCompare(b.name);
      return a.isEnabled ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  const handleSourcePress = (source: Source) => {
    navigation.navigate("SourceDetail", {
      sourceId: source.id,
      sourceName: source.name,
    });
  };

  const renderSource = ({ item }: { item: Source }) => (
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
              color: item.isEnabled ? theme.colors.success : theme.colors.error,
            },
          ]}
        >
          {item.isEnabled ? "Enabled" : "Disabled"}
        </Text>
      </View>
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

      <FlatList
        data={filteredSources}
        renderItem={renderSource}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
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
});
