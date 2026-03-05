// src/components/common/NovelCard.tsx
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Image } from "expo-image";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { DisplayMode, Novel } from "../../types";

interface NovelCardProps {
  novel: Novel;
  displayMode: DisplayMode;
  showDownloadBadge?: boolean;
  showUnreadBadge?: boolean;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}

const NovelCardComponent: React.FC<NovelCardProps> = ({
  novel,
  displayMode,
  showDownloadBadge = true,
  showUnreadBadge = true,
  isSelectionMode = false,
  isSelected = false,
  onPress,
  onLongPress,
}) => {
  const { theme } = useTheme();
  const totalChapters =
    typeof novel.totalChapters === "number" && novel.totalChapters > 0
      ? novel.totalChapters
      : 0;
  const totalChaptersRead =
    totalChapters > 0 ? totalChapters - (novel.unreadChapters || 0) : 0;
  const progressPercent =
    totalChapters > 0 ? (totalChaptersRead / totalChapters) * 100 : 0;

  // LIST MODE
  if (displayMode === "list") {
    return (
      <TouchableOpacity
        style={[
          styles.listContainer,
          {
            backgroundColor: theme.colors.surface,
            borderWidth: isSelectionMode ? 2 : 0,
            borderColor: isSelected ? theme.colors.primary : theme.colors.border,
          },
        ]}
        onPress={onPress}
        onLongPress={onLongPress}
        activeOpacity={0.7}
      >
        {/* Cover Image */}
        <View style={styles.listCoverContainer}>
          <Image
            source={{ uri: novel.coverUrl }}
            style={styles.listCover}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
          {isSelectionMode ? (
            <View
              style={[
                styles.selectionIndicator,
                isSelected
                  ? { backgroundColor: theme.colors.primary, borderWidth: 0 }
                  : {
                      backgroundColor: "rgba(0,0,0,0.35)",
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.9)",
                    },
              ]}
            >
              {isSelected ? (
                <Ionicons name="checkmark" size={16} color="#FFF" />
              ) : null}
            </View>
          ) : null}
          {/* Status indicator on cover */}
          {novel.status === "completed" && (
            <View
              style={[
                styles.listStatusBadge,
                { backgroundColor: theme.colors.success },
              ]}
            >
              <Text style={styles.listStatusText}>DONE</Text>
            </View>
          )}
        </View>

        {/* Content */}
        <View style={styles.listContent}>
          {/* Title and Badges Row */}
          <View style={styles.listHeader}>
            <Text
              style={[styles.listTitle, { color: theme.colors.text }]}
              numberOfLines={2}
            >
              {novel.title}
            </Text>
            <View style={styles.listBadges}>
              {showUnreadBadge && novel.unreadChapters > 0 && (
                <View
                  style={[
                    styles.listUnreadBadge,
                    { backgroundColor: theme.colors.primary },
                  ]}
                >
                  <Text style={styles.badgeText}>{novel.unreadChapters}</Text>
                </View>
              )}
              {showDownloadBadge && novel.isDownloaded && (
                <View
                  style={[
                    styles.listDownloadBadge,
                    { backgroundColor: theme.colors.success },
                  ]}
                >
                  <Ionicons name="download" size={10} color="#FFF" />
                </View>
              )}
            </View>
          </View>

          {/* Author */}
          <Text
            style={[styles.listAuthor, { color: theme.colors.textSecondary }]}
            numberOfLines={1}
          >
            {novel.author}
          </Text>

          {/* Progress Info */}
          <View style={styles.listProgressContainer}>
            <View style={styles.listProgressBarContainer}>
              <View
                style={[
                  styles.listProgressBar,
                  { backgroundColor: theme.colors.border },
                ]}
              >
                <View
                  style={[
                    styles.listProgressFill,
                    {
                      backgroundColor:
                        novel.unreadChapters === 0
                          ? theme.colors.success
                          : theme.colors.primary,
                      width: `${progressPercent}%`,
                    },
                  ]}
                />
              </View>
              <Text
                style={[
                  styles.listProgressText,
                  { color: theme.colors.textSecondary },
                ]}
              >
                {totalChaptersRead}/{totalChapters}
              </Text>
            </View>

            {/* Source tag */}
            <View
              style={[
                styles.sourceTag,
                { backgroundColor: theme.colors.border },
              ]}
            >
              <Text
                style={[
                  styles.sourceText,
                  { color: theme.colors.textSecondary },
                ]}
              >
                {novel.source}
              </Text>
            </View>
          </View>

          {/* Last read info */}
          {novel.lastReadDate && (
            <View style={styles.listLastReadRow}>
              <Ionicons
                name="time-outline"
                size={12}
                color={theme.colors.textSecondary}
              />
              <Text
                style={[
                  styles.listLastRead,
                  { color: theme.colors.textSecondary },
                ]}
              >
                {"  "}Last read {formatLastRead(novel.lastReadDate)}
              </Text>
            </View>
          )}
        </View>

        {/* Arrow indicator */}
        <Ionicons
          name="chevron-forward"
          size={20}
          color={theme.colors.textSecondary}
          style={styles.listArrow}
        />
      </TouchableOpacity>
    );
  }

  // GRID MODE (Compact Grid)
  return (
    <TouchableOpacity
      style={styles.gridContainer}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.gridCoverContainer,
          isSelectionMode && {
            borderWidth: 2,
            borderColor: isSelected ? theme.colors.primary : theme.colors.border,
          },
        ]}
      >
        <Image
          source={{ uri: novel.coverUrl }}
          style={styles.gridCover}
          contentFit="cover"
          cachePolicy="memory-disk"
        />

        {isSelectionMode ? (
          <View
            style={[
              styles.selectionIndicator,
              isSelected
                ? { backgroundColor: theme.colors.primary, borderWidth: 0 }
                : {
                    backgroundColor: "rgba(0,0,0,0.35)",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.9)",
                  },
            ]}
          >
            {isSelected ? (
              <Ionicons name="checkmark" size={16} color="#FFF" />
            ) : null}
          </View>
        ) : null}

        {/* Unread Badge */}
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

        {/* Download Badge */}
        {!isSelectionMode && showDownloadBadge && novel.isDownloaded && (
          <View
            style={[
              styles.gridDownloadBadge,
              { backgroundColor: theme.colors.success },
            ]}
          >
            <Ionicons name="download" size={10} color="#FFF" />
          </View>
        )}

        {/* Completion Badge */}
        {novel.status === "completed" && (
          <View
            style={[
              styles.gridStatusBadge,
              { backgroundColor: theme.colors.success },
            ]}
          >
            <Text style={styles.statusText}>DONE</Text>
          </View>
        )}
      </View>

      {/* Title */}
      <Text
        style={[styles.gridTitle, { color: theme.colors.text }]}
        numberOfLines={2}
      >
        {novel.title}
      </Text>

      {/* Chapter info */}
      <Text
        style={[styles.gridSubtitle, { color: theme.colors.textSecondary }]}
      >
        Ch. {novel.lastReadChapter || 0}/{novel.totalChapters}
      </Text>
    </TouchableOpacity>
  );
};

export const NovelCard = React.memo(NovelCardComponent);

// Helper function to format last read time
const formatLastRead = (date: Date): string => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours === 0) {
      const minutes = Math.floor(diff / (1000 * 60));
      return minutes <= 1 ? "just now" : `${minutes}m ago`;
    }
    return `${hours}h ago`;
  } else if (days === 1) {
    return "yesterday";
  } else if (days < 7) {
    return `${days}d ago`;
  } else if (days < 30) {
    return `${Math.floor(days / 7)}w ago`;
  } else {
    return `${Math.floor(days / 30)}mo ago`;
  }
};

const styles = StyleSheet.create({
  selectionIndicator: {
    position: "absolute",
    top: 6,
    left: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 5,
  },
  // GRID MODE STYLES
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
  },
  gridBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  gridDownloadBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  gridStatusBadge: {
    position: "absolute",
    bottom: 6,
    right: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  gridTitle: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 6,
    lineHeight: 16,
  },
  gridSubtitle: {
    fontSize: 10,
    marginTop: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#FFF",
  },
  statusText: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#FFF",
  },

  // LIST MODE STYLES
  listContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  listCoverContainer: {
    position: "relative",
  },
  listCover: {
    width: 70,
    height: 105,
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
  },
  listStatusBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
  },
  listStatusText: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#FFF",
  },
  listContent: {
    flex: 1,
    marginLeft: 14,
    justifyContent: "space-between",
    height: 105,
    paddingVertical: 2,
  },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  listTitle: {
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
    flex: 1,
    marginRight: 8,
  },
  listBadges: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  listUnreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 5,
  },
  listDownloadBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  listAuthor: {
    fontSize: 13,
    marginTop: 2,
  },
  listProgressContainer: {
    marginTop: "auto",
  },
  listProgressBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  listProgressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
    marginRight: 8,
  },
  listProgressFill: {
    height: "100%",
    borderRadius: 2,
  },
  listProgressText: {
    fontSize: 11,
    fontWeight: "500",
    minWidth: 50,
    textAlign: "right",
  },
  sourceTag: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  sourceText: {
    fontSize: 10,
    fontWeight: "500",
  },
  listLastRead: {
    fontSize: 11,
  },
  listLastReadRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  listArrow: {
    marginLeft: 8,
  },
});
