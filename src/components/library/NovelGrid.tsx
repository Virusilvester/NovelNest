// src/components/library/NovelGrid.tsx
import React from "react";
import { Dimensions, FlatList, StyleSheet, View } from "react-native";
import { DisplayMode, Novel } from "../../types";
import { NovelCard } from "../common/NovelCard";

interface NovelGridProps {
  novels: Novel[];
  displayMode: DisplayMode;
  showDownloadBadges: boolean;
  showUnreadBadges: boolean;
  onNovelPress: (novel: Novel) => void;
  onNovelLongPress?: (novel: Novel) => void;
}

const { width } = Dimensions.get("window");
const GRID_COLUMNS = 3;
const GRID_SPACING = 12;

export const NovelGrid: React.FC<NovelGridProps> = ({
  novels,
  displayMode,
  showDownloadBadges,
  showUnreadBadges,
  onNovelPress,
  onNovelLongPress,
}) => {
  // LIST MODE: Single column flat list with key="list" to force re-render
  if (displayMode === "list") {
    return (
      <FlatList
        key="list" // Force fresh render when switching to list
        data={novels}
        renderItem={({ item }) => (
          <NovelCard
            novel={item}
            displayMode="list"
            showDownloadBadge={showDownloadBadges}
            showUnreadBadge={showUnreadBadges}
            onPress={() => onNovelPress(item)}
            onLongPress={() => onNovelLongPress?.(item)}
          />
        )}
        keyExtractor={(item) => `list-${item.id}`}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={false}
      />
    );
  }

  // GRID MODE: 3-column grid with key="grid" to force re-render
  const renderGridItem = ({ item }: { item: Novel }) => (
    <View style={styles.gridItem}>
      <NovelCard
        novel={item}
        displayMode="compactGrid"
        showDownloadBadge={showDownloadBadges}
        showUnreadBadge={showUnreadBadges}
        onPress={() => onNovelPress(item)}
        onLongPress={() => onNovelLongPress?.(item)}
      />
    </View>
  );

  return (
    <FlatList
      key="grid" // Force fresh render when switching to grid
      data={novels}
      renderItem={renderGridItem}
      keyExtractor={(item) => `grid-${item.id}`}
      numColumns={GRID_COLUMNS}
      contentContainerStyle={styles.gridContent}
      showsVerticalScrollIndicator={false}
      columnWrapperStyle={styles.gridRow}
      removeClippedSubviews={false}
    />
  );
};

const styles = StyleSheet.create({
  // List mode styles
  listContent: {
    padding: 12,
    paddingTop: 8,
  },

  // Grid mode styles
  gridContent: {
    padding: GRID_SPACING,
    paddingTop: 8,
  },
  gridRow: {
    justifyContent: "space-between",
    marginBottom: GRID_SPACING,
  },
  gridItem: {
    width: (width - GRID_SPACING * (GRID_COLUMNS + 1)) / GRID_COLUMNS,
  },
});
