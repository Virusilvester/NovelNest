// src/screens/main/LibraryScreen.tsx
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { FlatList, StyleSheet, TouchableOpacity, View } from "react-native";
import { FilterPanel } from "../../components/common/FilterPanel";
import { Header } from "../../components/common/Header";
import { PopupMenu } from "../../components/common/PopupMenu";
import { CategorySection } from "../../components/library/CategorySection";
import { useLibrary } from "../../context/LibraryContext";
import { useTheme } from "../../context/ThemeContext";
import { Novel } from "../../types";

export const LibraryScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const {
    novels,
    categories,
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
  } = useLibrary();

  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isFilterPanelVisible, setIsFilterPanelVisible] = useState(false);
  const [isMenuVisible, setIsMenuVisible] = useState(false);

  const handleNovelPress = useCallback(
    (novel: Novel) => {
      navigation.navigate("NovelDetail", { novelId: novel.id });
    },
    [navigation],
  );

  const handleUpdateLibrary = useCallback(async () => {
    await updateLibrary();
  }, [updateLibrary]);

  const menuItems = [
    {
      id: "update",
      label: "Update library",
      onPress: handleUpdateLibrary,
    },
  ];

  const renderCategory = ({
    item: category,
  }: {
    item: (typeof categories)[0];
  }) => {
    const categoryNovels = novels.filter((n) =>
      category.novelIds.includes(n.id),
    );
    return (
      <CategorySection
        category={category}
        novels={categoryNovels}
        displayMode={displayMode}
        showDownloadBadges={showDownloadBadges}
        showUnreadBadges={showUnreadBadges}
        showItemCount={showItemCount}
        onNovelPress={handleNovelPress}
      />
    );
  };

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Header
        title="Library"
        onMenuPress={() => navigation.openDrawer()}
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
          ) : null
        }
      />

      <FlatList
        data={categories}
        renderItem={renderCategory}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
      />

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
  content: {
    paddingTop: 8,
  },
  iconButton: {
    padding: 8,
  },
});
