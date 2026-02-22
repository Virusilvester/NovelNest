// src/components/library/CategorySection.tsx
import React from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { Category, DisplayMode, Novel } from "../../types";
import { NovelCard } from "../common/NovelCard";

interface CategorySectionProps {
  category: Category;
  novels: Novel[];
  displayMode: DisplayMode;
  showDownloadBadges: boolean;
  showUnreadBadges: boolean;
  showItemCount: boolean;
  onNovelPress: (novel: Novel) => void;
}

export const CategorySection: React.FC<CategorySectionProps> = ({
  category,
  novels,
  displayMode,
  showDownloadBadges,
  showUnreadBadges,
  showItemCount,
  onNovelPress,
}) => {
  const { theme } = useTheme();

  const renderNovel = ({ item }: { item: Novel }) => (
    <NovelCard
      novel={item}
      displayMode={displayMode}
      showDownloadBadge={showDownloadBadges}
      showUnreadBadge={showUnreadBadges}
      onPress={() => onNovelPress(item)}
    />
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          {category.name}
        </Text>
        {showItemCount && (
          <Text style={[styles.count, { color: theme.colors.textSecondary }]}>
            {novels.length}
          </Text>
        )}
      </View>
      {displayMode === "compactGrid" ? (
        <View style={styles.grid}>
          {novels.map((novel) => (
            <View key={novel.id} style={styles.gridItem}>
              <NovelCard
                novel={novel}
                displayMode={displayMode}
                showDownloadBadge={showDownloadBadges}
                showUnreadBadge={showUnreadBadges}
                onPress={() => onNovelPress(novel)}
              />
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={novels}
          renderItem={renderNovel}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
  },
  count: {
    fontSize: 14,
    marginLeft: 8,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
  },
  gridItem: {
    width: "33.33%",
    padding: 4,
  },
});
