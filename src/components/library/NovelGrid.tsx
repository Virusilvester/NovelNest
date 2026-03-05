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
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onNovelPress: (novel: Novel) => void;
  onNovelLongPress?: (novel: Novel) => void;
  onEndReached?: () => void;
  onEndReachedThreshold?: number;
  ListFooterComponent?: React.ReactElement | null;
  refreshing?: boolean;
  onRefresh?: () => void;
}

const GRID_SPACING = 12;

export const NovelGrid: React.FC<NovelGridProps> = ({
  novels,
  displayMode,
  showDownloadBadges,
  showUnreadBadges,
  selectionMode = false,
  selectedIds,
  onNovelPress,
  onNovelLongPress,
  onEndReached,
  onEndReachedThreshold,
  ListFooterComponent,
  refreshing,
  onRefresh,
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
            isSelectionMode={selectionMode}
            isSelected={Boolean(selectedIds?.has(item.id))}
            onPress={() => onNovelPress(item)}
            onLongPress={() => onNovelLongPress?.(item)}
          />
        )}
        keyExtractor={(item) => `list-${item.id}`}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={false}
        onEndReached={onEndReached}
        onEndReachedThreshold={onEndReachedThreshold}
        ListFooterComponent={ListFooterComponent}
        refreshing={refreshing}
        onRefresh={onRefresh}
      />
    );
  }

  // GRID MODE: 3-column grid with key="grid" to force re-render
  const renderGridItem = ({ item, index }: { item: Novel; index: number }) => {
    const isLastInRow = (index + 1) % gridColumns === 0;
    return (
      <View
        style={[
          styles.gridItem,
          {
            width: gridItemWidth,
            marginEnd: isLastInRow ? 0 : GRID_SPACING,
            marginBottom: GRID_SPACING,
          },
        ]}
      >
        <NovelCard
          novel={item}
          displayMode="compactGrid"
          showDownloadBadge={showDownloadBadges}
          showUnreadBadge={showUnreadBadges}
          isSelectionMode={selectionMode}
          isSelected={Boolean(selectedIds?.has(item.id))}
          onPress={() => onNovelPress(item)}
          onLongPress={() => onNovelLongPress?.(item)}
        />
      </View>
    );
  };

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
      onEndReached={onEndReached}
      onEndReachedThreshold={onEndReachedThreshold}
      ListFooterComponent={ListFooterComponent}
      refreshing={refreshing}
      onRefresh={onRefresh}
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
    justifyContent: "flex-start",
  },
  gridItem: {
    // width set dynamically to react to rotation / resize
  },
});
