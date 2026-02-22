// src/screens/sources/SourceDetailScreen.tsx
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import React, { useState } from "react";
import { FlatList, StyleSheet, TouchableOpacity, View } from "react-native";
import { Header } from "../../components/common/Header";
import { NovelCard } from "../../components/common/NovelCard";
import { PopupMenu } from "../../components/common/PopupMenu";
import { useTheme } from "../../context/ThemeContext";
import { DisplayMode, Novel, SourceSortOption } from "../../types";

// Mock novels
const mockNovels: Novel[] = [];

export const SourceDetailScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { theme } = useTheme();

  const { sourceName } = route.params as { sourceName: string };

  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<SourceSortOption>("popular");
  const [isFilterPanelVisible, setIsFilterPanelVisible] = useState(false);
  const [isMoreMenuVisible, setIsMoreMenuVisible] = useState(false);
  const [displayMode, setDisplayMode] = useState<DisplayMode>("compactGrid");

  const handleNovelPress = (novel: Novel) => {
    navigation.navigate("NovelDetail", { novelId: novel.id });
  };

  const handleWebView = () => {
    navigation.navigate("WebView", { url: "https://example.com" });
  };

  const sortOptions = [
    {
      id: "popular",
      label: "Popular",
      onPress: () => setSortOption("popular"),
    },
    { id: "latest", label: "Latest", onPress: () => setSortOption("latest") },
    {
      id: "topRated",
      label: "Top Rated",
      onPress: () => setSortOption("topRated"),
    },
    {
      id: "completed",
      label: "Completed",
      onPress: () => setSortOption("completed"),
    },
  ];

  const moreMenuItems = [
    {
      id: "displayMode",
      label: "Display mode",
      onPress: () => {
        // Show display mode submenu
        setIsMoreMenuVisible(false);
        // Toggle or show submenu
      },
    },
    {
      id: "webView",
      label: "Open in WebView",
      onPress: handleWebView,
    },
  ];

  const renderNovel = ({ item }: { item: Novel }) => (
    <NovelCard
      novel={item}
      displayMode={displayMode}
      onPress={() => handleNovelPress(item)}
    />
  );

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Header
        title={sourceName}
        onBackPress={() => navigation.goBack()}
        showSearch={!isSearchActive}
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
                onPress={() => setIsFilterPanelVisible(true)}
                style={styles.iconButton}
              >
                <Ionicons name="filter" size={24} color={theme.colors.text} />
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
          ) : null
        }
      />

      <FlatList
        data={mockNovels}
        renderItem={renderNovel}
        keyExtractor={(item) => item.id}
        numColumns={displayMode === "compactGrid" ? 3 : 1}
        contentContainerStyle={styles.listContent}
      />

      <PopupMenu
        visible={isFilterPanelVisible}
        onClose={() => setIsFilterPanelVisible(false)}
        items={sortOptions}
      />

      <PopupMenu
        visible={isMoreMenuVisible}
        onClose={() => setIsMoreMenuVisible(false)}
        items={moreMenuItems}
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
    padding: 8,
  },
});
