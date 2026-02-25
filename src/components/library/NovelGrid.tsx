// src/components/library/NovelGrid.tsx
import React from "react";
import { FlatList, StyleSheet, useWindowDimensions, View } from "react-native";
import { DisplayMode, Novel } from "../../types";
import { NovelCard } from "../common/NovelCard";
import { getGridColumns, getGridItemWidth } from "../../utils/responsive";

interface NovelGridProps {
  novels: Novel[];
  displayMode: DisplayMode;
  showDownloadBadges: boolean;
  showUnreadBadges: boolean;
  onNovelPress: (novel: Novel) => void;
  onNovelLongPress?: (novel: Novel) => void;
}

const GRID_SPACING = 12;

export const NovelGrid: React.FC<NovelGridProps> = ({
  novels,
  displayMode,
  showDownloadBadges,
  showUnreadBadges,
  onNovelPress,
  onNovelLongPress,
}) => {
  const { width } = useWindowDimensions();
  const gridColumns = getGridColumns(width);
  const gridItemWidth = getGridItemWidth(width, gridColumns, GRID_SPACING);

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
    <View style={[styles.gridItem, { width: gridItemWidth }]}>
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
      key={`grid-${gridColumns}`} // Force fresh render when columns change (rotation / resize)
      data={novels}
      renderItem={renderGridItem}
      keyExtractor={(item) => `grid-${item.id}`}
      numColumns={gridColumns}
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
    // width set dynamically to react to rotation / resize
  },
});
