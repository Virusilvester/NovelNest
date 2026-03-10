// src/components/library/NovelGrid.tsx
import { FlashList, ListRenderItem } from "@shopify/flash-list";
import React, { useCallback } from "react";
import { Platform, StyleSheet, useWindowDimensions, View } from "react-native";
import { DisplayMode, Novel } from "../../types";
import { getGridColumns, getGridItemWidth } from "../../utils/responsive";
import { NovelCard } from "../common/NovelCard";

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

type NovelCardItemProps = {
  novel: Novel;
  displayMode: DisplayMode;
  showDownloadBadge: boolean;
  showUnreadBadge: boolean;
  isSelectionMode: boolean;
  isSelected: boolean;
  onNovelPress: (novel: Novel) => void;
  onNovelLongPress?: (novel: Novel) => void;
};

const NovelCardItem = React.memo(
  ({
    novel,
    displayMode,
    showDownloadBadge,
    showUnreadBadge,
    isSelectionMode,
    isSelected,
    onNovelPress,
    onNovelLongPress,
  }: NovelCardItemProps) => {
    const handlePress = useCallback(
      () => onNovelPress(novel),
      [onNovelPress, novel],
    );
    const handleLongPress = useCallback(
      () => onNovelLongPress?.(novel),
      [onNovelLongPress, novel],
    );

    return (
      <NovelCard
        novel={novel}
        displayMode={displayMode}
        showDownloadBadge={showDownloadBadge}
        showUnreadBadge={showUnreadBadge}
        isSelectionMode={isSelectionMode}
        isSelected={isSelected}
        onPress={handlePress}
        onLongPress={onNovelLongPress ? handleLongPress : undefined}
      />
    );
  },
  (prev, next) =>
    prev.novel === next.novel &&
    prev.displayMode === next.displayMode &&
    prev.showDownloadBadge === next.showDownloadBadge &&
    prev.showUnreadBadge === next.showUnreadBadge &&
    prev.isSelectionMode === next.isSelectionMode &&
    prev.isSelected === next.isSelected &&
    prev.onNovelPress === next.onNovelPress &&
    prev.onNovelLongPress === next.onNovelLongPress,
);
NovelCardItem.displayName = "NovelCardItem";

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
    const renderItem: ListRenderItem<Novel> = ({ item }) => (
      <NovelCardItem
        novel={item}
        displayMode="list"
        showDownloadBadge={showDownloadBadges}
        showUnreadBadge={showUnreadBadges}
        isSelectionMode={selectionMode}
        isSelected={Boolean(selectedIds?.has(item.id))}
        onNovelPress={onNovelPress}
        onNovelLongPress={onNovelLongPress}
      />
    );

    return (
      <FlashList
        key="list" // Force fresh render when switching to list
        data={novels}
        renderItem={renderItem}
        keyExtractor={(item) => `list-${item.id}`}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={Platform.OS === "android"}
        onEndReached={onEndReached}
        onEndReachedThreshold={onEndReachedThreshold}
        ListFooterComponent={ListFooterComponent}
        refreshing={refreshing}
        onRefresh={onRefresh}
      />
    );
  }

  // GRID MODE: 3-column grid with key="grid" to force re-render
  const renderGridItem: ListRenderItem<Novel> = ({ item, index }) => {
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
        <NovelCardItem
          novel={item}
          displayMode="compactGrid"
          showDownloadBadge={showDownloadBadges}
          showUnreadBadge={showUnreadBadges}
          isSelectionMode={selectionMode}
          isSelected={Boolean(selectedIds?.has(item.id))}
          onNovelPress={onNovelPress}
          onNovelLongPress={onNovelLongPress}
        />
      </View>
    );
  };

  return (
    <FlashList
      key={`grid-${gridColumns}`} // Force fresh render when columns change (rotation / resize)
      data={novels}
      renderItem={renderGridItem}
      keyExtractor={(item) => `grid-${item.id}`}
      numColumns={gridColumns}
      contentContainerStyle={styles.gridContent}
      showsVerticalScrollIndicator={false}
      removeClippedSubviews={Platform.OS === "android"}
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
  gridItem: {
    // width set dynamically to react to rotation / resize
  },
});
