// src/components/common/NovelCard.tsx
import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { DisplayMode, Novel } from "../../types";

interface NovelCardProps {
  novel: Novel;
  displayMode: DisplayMode;
  showDownloadBadge?: boolean;
  showUnreadBadge?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}

export const NovelCard: React.FC<NovelCardProps> = ({
  novel,
  displayMode,
  showDownloadBadge = true,
  showUnreadBadge = true,
  onPress,
  onLongPress,
}) => {
  const { theme } = useTheme();

  if (displayMode === "list") {
    return (
      <TouchableOpacity
        style={[
          styles.listContainer,
          { backgroundColor: theme.colors.surface },
        ]}
        onPress={onPress}
        onLongPress={onLongPress}
      >
        <Image source={{ uri: novel.coverUrl }} style={styles.listCover} />
        <View style={styles.listInfo}>
          <Text
            style={[styles.listTitle, { color: theme.colors.text }]}
            numberOfLines={2}
          >
            {novel.title}
          </Text>
          <Text
            style={[styles.listSubtitle, { color: theme.colors.textSecondary }]}
          >
            {novel.author}
          </Text>
          <View style={styles.listBadges}>
            {showUnreadBadge && novel.unreadChapters > 0 && (
              <Badge
                text={`${novel.unreadChapters}`}
                color={theme.colors.primary}
                textColor="#FFF"
              />
            )}
            {showDownloadBadge && novel.isDownloaded && (
              <Badge
                icon="download"
                color={theme.colors.success}
                textColor="#FFF"
              />
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={styles.gridContainer}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      <View style={styles.gridCoverContainer}>
        <Image source={{ uri: novel.coverUrl }} style={styles.gridCover} />
        {showUnreadBadge && novel.unreadChapters > 0 && (
          <View
            style={[styles.badge, { backgroundColor: theme.colors.primary }]}
          >
            <Text style={styles.badgeText}>{novel.unreadChapters}</Text>
          </View>
        )}
        {showDownloadBadge && novel.isDownloaded && (
          <View
            style={[
              styles.downloadBadge,
              { backgroundColor: theme.colors.success },
            ]}
          >
            <Text style={styles.badgeText}>↓</Text>
          </View>
        )}
      </View>
      <Text
        style={[styles.gridTitle, { color: theme.colors.text }]}
        numberOfLines={2}
      >
        {novel.title}
      </Text>
    </TouchableOpacity>
  );
};

const Badge: React.FC<{
  text?: string;
  icon?: string;
  color: string;
  textColor: string;
}> = ({ text, color, textColor }) => (
  <View style={[styles.badge, { backgroundColor: color }]}>
    <Text style={[styles.badgeText, { color: textColor }]}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  gridContainer: {
    flex: 1,
    margin: 4,
    maxWidth: "33%",
  },
  gridCoverContainer: {
    aspectRatio: 2 / 3,
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
  },
  gridCover: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  gridTitle: {
    fontSize: 12,
    marginTop: 4,
    textAlign: "center",
  },
  listContainer: {
    flexDirection: "row",
    padding: 12,
    marginVertical: 4,
    marginHorizontal: 8,
    borderRadius: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
  },
  listCover: {
    width: 60,
    height: 90,
    borderRadius: 4,
  },
  listInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: "center",
  },
  listTitle: {
    fontSize: 16,
    fontWeight: "bold",
  },
  listSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  listBadges: {
    flexDirection: "row",
    marginTop: 8,
    gap: 8,
  },
  badge: {
    position: "absolute",
    top: 4,
    right: 4,
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  downloadBadge: {
    position: "absolute",
    top: 4,
    left: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#FFF",
  },
});
