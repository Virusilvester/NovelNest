// src/components/common/NovelCard.tsx
import React from "react";
import {
  Dimensions,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { DisplayMode, Novel } from "../../types";

const { width } = Dimensions.get("window");
const GRID_ITEM_WIDTH = (width - 32) / 3;

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
        activeOpacity={0.7}
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
            numberOfLines={1}
          >
            {novel.author}
          </Text>
          <View style={styles.listBadges}>
            {showUnreadBadge && novel.unreadChapters > 0 && (
              <View
                style={[
                  styles.badge,
                  { backgroundColor: theme.colors.primary },
                ]}
              >
                <Text style={styles.badgeText}>{novel.unreadChapters}</Text>
              </View>
            )}
            {showDownloadBadge && novel.isDownloaded && (
              <View
                style={[
                  styles.badge,
                  { backgroundColor: theme.colors.success },
                ]}
              >
                <Text style={styles.badgeText}>↓</Text>
              </View>
            )}
            <Text
              style={[
                styles.chapterText,
                { color: theme.colors.textSecondary },
              ]}
            >
              Ch. {novel.lastReadChapter || 0}/{novel.totalChapters}
            </Text>
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
      activeOpacity={0.7}
    >
      <View style={styles.gridCoverContainer}>
        <Image source={{ uri: novel.coverUrl }} style={styles.gridCover} />
        {showUnreadBadge && novel.unreadChapters > 0 && (
          <View
            style={[
              styles.gridBadge,
              { backgroundColor: theme.colors.primary },
            ]}
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
        {novel.status === "completed" && (
          <View
            style={[
              styles.statusIndicator,
              { backgroundColor: theme.colors.success },
            ]}
          >
            <Text style={styles.statusText}>DONE</Text>
          </View>
        )}
      </View>
      <Text
        style={[styles.gridTitle, { color: theme.colors.text }]}
        numberOfLines={2}
      >
        {novel.title}
      </Text>
      <Text
        style={[styles.gridSubtitle, { color: theme.colors.textSecondary }]}
        numberOfLines={1}
      >
        Ch. {novel.lastReadChapter || 0}/{novel.totalChapters}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  gridContainer: {
    width: "100%",
  },
  gridCoverContainer: {
    aspectRatio: 2 / 3,
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#f0f0f0",
  },
  gridCover: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  gridTitle: {
    fontSize: 12,
    marginTop: 6,
    fontWeight: "600",
    lineHeight: 16,
  },
  gridSubtitle: {
    fontSize: 10,
    marginTop: 2,
  },
  gridBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  downloadBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  statusIndicator: {
    position: "absolute",
    bottom: 6,
    right: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#FFF",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#FFF",
  },
  listContainer: {
    flexDirection: "row",
    padding: 12,
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
    backgroundColor: "#f0f0f0",
  },
  listInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: "center",
  },
  listTitle: {
    fontSize: 15,
    fontWeight: "bold",
    lineHeight: 20,
  },
  listSubtitle: {
    fontSize: 13,
    marginTop: 4,
  },
  listBadges: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 8,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  chapterText: {
    fontSize: 12,
  },
});
