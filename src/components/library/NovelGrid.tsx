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
const GRID_SPACING = 8;
const GRID_ITEM_WIDTH =
  (width - GRID_SPACING * (GRID_COLUMNS + 1)) / GRID_COLUMNS;

export const NovelGrid: React.FC<NovelGridProps> = ({
  novels,
  displayMode,
  showDownloadBadges,
  showUnreadBadges,
  onNovelPress,
  onNovelLongPress,
}) => {
  const renderNovel = ({ item }: { item: Novel }) => (
    <View
      style={displayMode === "compactGrid" ? styles.gridItem : styles.listItem}
    >
      <NovelCard
        novel={item}
        displayMode={displayMode}
        showDownloadBadge={showDownloadBadges}
        showUnreadBadge={showUnreadBadges}
        onPress={() => onNovelPress(item)}
        onLongPress={() => onNovelLongPress?.(item)}
      />
    </View>
  );

  if (displayMode === "list") {
    return (
      <FlatList
        data={novels}
        renderItem={renderNovel}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    );
  }

  return (
    <FlatList
      data={novels}
      renderItem={renderNovel}
      keyExtractor={(item) => item.id}
      numColumns={GRID_COLUMNS}
      contentContainerStyle={styles.gridContent}
      showsVerticalScrollIndicator={false}
    />
  );
};

const styles = StyleSheet.create({
  gridContent: {
    padding: GRID_SPACING,
  },
  listContent: {
    padding: 8,
  },
  gridItem: {
    width: GRID_ITEM_WIDTH,
    margin: GRID_SPACING / 2,
  },
  listItem: {
    marginBottom: 8,
  },
});
