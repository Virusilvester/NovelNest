// src/screens/main/LibraryScreen.tsx
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FilterPanel } from "../../components/common/FilterPanel";
import { Header } from "../../components/common/Header";
import { PopupMenu } from "../../components/common/PopupMenu";
import { CategoryTabs } from "../../components/library/CategoryTabs";
import { NovelGrid } from "../../components/library/NovelGrid";
import { useLibrary } from "../../context/LibraryContext";
import { useTheme } from "../../context/ThemeContext";
import { Novel } from "../../types";

export const LibraryScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const {
    categories,
    selectedCategoryId,
    selectCategory,
    filterOptions,
    setFilterOptions,
    sortOption,
    setSortOption,
    displayMode,
    setDisplayMode,
    showDownloadBadges,
    setShowDownloadBadges,
    showUnreadBadges,
    setShowUnreadBadges,
    showItemCount,
    setShowItemCount,
    updateLibrary,
    getFilteredNovels,
    novels,
  } = useLibrary();

  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isFilterPanelVisible, setIsFilterPanelVisible] = useState(false);
  const [isMenuVisible, setIsMenuVisible] = useState(false);

  const filteredNovels = getFilteredNovels();

  // Apply search filter
  const displayedNovels = searchQuery
    ? filteredNovels.filter(
        (n) =>
          n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          n.author.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : filteredNovels;

  const handleNovelPress = useCallback(
    (novel: Novel) => {
      navigation.navigate("NovelDetail", { novelId: novel.id });
    },
    [navigation],
  );

  const handleUpdateLibrary = useCallback(async () => {
    await updateLibrary();
  }, [updateLibrary]);

  const getItemCount = useCallback(
    (categoryId: string) => {
      if (categoryId === "all") return novels.length;
      return novels.filter((n) => n.categoryId === categoryId).length;
    },
    [novels],
  );

  const menuItems = [
    {
      id: "update",
      label: "Update library",
      onPress: handleUpdateLibrary,
    },
  ];

  // Custom right buttons for header - ONLY ONE SEARCH BUTTON
  const headerRightButtons = (
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
        onPress={() => setIsMenuVisible(true)}
        style={styles.iconButton}
      >
        <Ionicons
          name="ellipsis-vertical"
          size={24}
          color={theme.colors.text}
        />
      </TouchableOpacity>
    </>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons
        name="book-outline"
        size={64}
        color={theme.colors.textSecondary}
      />
      <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
        No novels found
      </Text>
      <Text
        style={[styles.emptySubtext, { color: theme.colors.textSecondary }]}
      >
        {selectedCategoryId === "all"
          ? "Your library is empty"
          : "No novels in this category"}
      </Text>
    </View>
  );

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Header
        title="Library"
        onMenuPress={() => navigation.openDrawer()}
        isSearchActive={isSearchActive}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={() => {
          // Handle search submit if needed
        }}
        onSearchClose={() => {
          setIsSearchActive(false);
          setSearchQuery("");
        }}
        rightButtons={!isSearchActive ? headerRightButtons : undefined}
      />

      <CategoryTabs
        categories={categories}
        selectedId={selectedCategoryId}
        onSelect={selectCategory}
        getItemCount={getItemCount}
        showItemCount={showItemCount}
      />

      {displayedNovels.length === 0 ? (
        renderEmptyState()
      ) : (
        <NovelGrid
          novels={displayedNovels}
          displayMode={displayMode} // This switches between 'compactGrid' and 'list'
          showDownloadBadges={showDownloadBadges}
          showUnreadBadges={showUnreadBadges}
          onNovelPress={handleNovelPress}
        />
      )}

      <FilterPanel
        visible={isFilterPanelVisible}
        onClose={() => setIsFilterPanelVisible(false)}
        filterOptions={filterOptions}
        onFilterChange={setFilterOptions}
        sortOption={sortOption}
        onSortChange={setSortOption}
        displayMode={displayMode}
        onDisplayModeChange={setDisplayMode}
        showDownloadBadges={showDownloadBadges}
        onShowDownloadBadgesChange={setShowDownloadBadges}
        showUnreadBadges={showUnreadBadges}
        onShowUnreadBadgesChange={setShowUnreadBadges}
        showItemCount={showItemCount}
        onShowItemCountChange={setShowItemCount}
      />

      <PopupMenu
        visible={isMenuVisible}
        onClose={() => setIsMenuVisible(false)}
        items={menuItems}
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
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
});
