// src/screens/library/NovelDetailScreen.tsx
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import React, { useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Header } from "../../components/common/Header";
import { PopupMenu } from "../../components/common/PopupMenu";
import { useLibrary } from "../../context/LibraryContext";
import { useTheme } from "../../context/ThemeContext";
import { Chapter, Novel } from "../../types";
import { clamp } from "../../utils/responsive";

// Mock chapters
const mockChapters: Chapter[] = [
  {
    id: "1",
    novelId: "1",
    title: "Chapter 1: The Beginning",
    number: 1,
    isRead: true,
    isDownloaded: true,
    releaseDate: new Date(),
  },
  {
    id: "2",
    novelId: "1",
    title: "Chapter 2: The Journey",
    number: 2,
    isRead: false,
    isDownloaded: false,
    releaseDate: new Date(),
  },
];

export const NovelDetailScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { theme } = useTheme();
  const { novels, updateNovel } = useLibrary();
  const { width } = useWindowDimensions();
  const coverWidth = clamp(Math.round(Math.min(width * 0.28, 160)), 96, 160);
  const coverHeight = Math.round(coverWidth * 1.5);

  const { novelId } = route.params as { novelId: string };
  const novel =
    novels.find((n) => n.id === novelId) ||
    ({
      id: "1",
      title: "Sample Novel",
      author: "Author Name",
      coverUrl: "https://via.placeholder.com/300x450",
      status: "ongoing",
      source: "Novel Updates",
      summary:
        "This is a sample novel summary. It contains exciting adventures and thrilling moments.",
      genres: ["Action", "Adventure", "Fantasy"],
      totalChapters: 100,
      unreadChapters: 99,
      isDownloaded: false,
      isInLibrary: true,
    } as Novel);

  const [isDownloadMenuVisible, setIsDownloadMenuVisible] = useState(false);
  const [isMoreMenuVisible, setIsMoreMenuVisible] = useState(false);
  const [isInLibrary, setIsInLibrary] = useState(novel.isInLibrary);

  const downloadOptions = [
    {
      id: "next",
      label: "Next chapter",
      onPress: () => console.log("Download next"),
    },
    {
      id: "next5",
      label: "Next 5 chapters",
      onPress: () => console.log("Download next 5"),
    },
    {
      id: "next10",
      label: "Next 10 chapters",
      onPress: () => console.log("Download next 10"),
    },
    {
      id: "custom",
      label: "Custom",
      onPress: () => console.log("Custom download"),
    },
    {
      id: "unread",
      label: "Unread",
      onPress: () => console.log("Download unread"),
    },
    { id: "all", label: "All", onPress: () => console.log("Download all") },
    {
      id: "delete",
      label: "Delete downloads",
      isDestructive: true,
      onPress: () => console.log("Delete downloads"),
    },
  ];

  const moreOptions = [
    {
      id: "editInfo",
      label: "Edit info",
      onPress: () => console.log("Edit info"),
    },
    {
      id: "editCover",
      label: "Edit cover",
      onPress: () => console.log("Edit cover"),
    },
  ];

  const handleShare = () => {
    // Implementation for sharing
  };

  const handleEpubExport = () => {
    // Implementation for EPUB export
  };

  const handleWebView = () => {
    navigation.navigate("WebView", {
      url: `https://example.com/novel/${novel.id}`,
    });
  };

  const handleLibraryToggle = () => {
    setIsInLibrary(!isInLibrary);
    updateNovel(novel.id, { isInLibrary: !isInLibrary });
  };

  const handleGenrePress = (genre: string) => {
    navigation.navigate("SourceDetail", { genre });
  };

  const handleChapterPress = (chapter: Chapter) => {
    navigation.navigate("Reader", { novelId: novel.id, chapterId: chapter.id });
  };

  const handleProgressPress = () => {
    const lastReadChapter = mockChapters.find((c) => c.id === "1"); // Mock
    if (lastReadChapter) {
      handleChapterPress(lastReadChapter);
    } else if (mockChapters.length > 0) {
      handleChapterPress(mockChapters[0]);
    }
  };

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Header
        title=""
        onBackPress={() => navigation.goBack()}
        rightButtons={
          <>
            <TouchableOpacity
              onPress={handleEpubExport}
              style={styles.iconButton}
            >
              <Ionicons
                name="document-text"
                size={24}
                color={theme.colors.text}
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleShare} style={styles.iconButton}>
              <Ionicons
                name="share-outline"
                size={24}
                color={theme.colors.text}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setIsDownloadMenuVisible(true)}
              style={styles.iconButton}
            >
              <Ionicons
                name="download-outline"
                size={24}
                color={theme.colors.text}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setIsMoreMenuVisible(true)}
              style={styles.iconButton}
            >
              <Ionicons
                name="ellipsis-vertical"
                size={24}
                color={theme.colors.text}
              />
            </TouchableOpacity>
          </>
        }
      />

      <ScrollView style={styles.content}>
        <View style={styles.headerSection}>
          <Image
            source={{ uri: novel.coverUrl }}
            style={[styles.cover, { width: coverWidth, height: coverHeight }]}
          />
          <View style={styles.headerInfo}>
            <Text
              style={[styles.title, { color: theme.colors.text }]}
              numberOfLines={3}
            >
              {novel.title}
            </Text>
            <Text
              style={[styles.author, { color: theme.colors.textSecondary }]}
            >
              {novel.author}
            </Text>
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor:
                      novel.status === "completed"
                        ? theme.colors.success
                        : theme.colors.warning,
                  },
                ]}
              >
                <Text style={styles.statusText}>{novel.status}</Text>
              </View>
              <Text
                style={[styles.source, { color: theme.colors.textSecondary }]}
              >
                {novel.source}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              { backgroundColor: theme.colors.primary },
            ]}
            onPress={handleLibraryToggle}
          >
            <Text style={styles.actionButtonText}>
              {isInLibrary ? "In library" : "Add to library"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.actionButton,
              {
                backgroundColor: theme.colors.surface,
                borderWidth: 1,
                borderColor: theme.colors.border,
              },
            ]}
            onPress={handleWebView}
          >
            <Text
              style={[styles.actionButtonText, { color: theme.colors.text }]}
            >
              WebView
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Summary
          </Text>
          <Text style={[styles.summary, { color: theme.colors.textSecondary }]}>
            {novel.summary}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Genres
          </Text>
          <View style={styles.genresContainer}>
            {novel.genres.map((genre) => (
              <TouchableOpacity
                key={genre}
                style={[
                  styles.genreTag,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                  },
                ]}
                onPress={() => handleGenrePress(genre)}
              >
                <Text
                  style={[styles.genreText, { color: theme.colors.primary }]}
                >
                  {genre}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={styles.progressSection}
          onPress={handleProgressPress}
        >
          <View style={styles.progressInfo}>
            <Text style={[styles.progressText, { color: theme.colors.text }]}>
              {novel.lastReadChapter
                ? `Continue: Chapter ${novel.lastReadChapter}`
                : "Start reading"}
            </Text>
            <Ionicons
              name="play-circle"
              size={24}
              color={theme.colors.primary}
            />
          </View>
          <View
            style={[
              styles.progressBar,
              { backgroundColor: theme.colors.border },
            ]}
          >
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: theme.colors.primary,
                  width: `${((novel.totalChapters - novel.unreadChapters) / novel.totalChapters) * 100}%`,
                },
              ]}
            />
          </View>
          <Text
            style={[styles.chapterCount, { color: theme.colors.textSecondary }]}
          >
            {novel.totalChapters - novel.unreadChapters} / {novel.totalChapters}{" "}
            chapters
          </Text>
        </TouchableOpacity>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Chapters
          </Text>
          {mockChapters.map((chapter) => (
            <TouchableOpacity
              key={chapter.id}
              style={[
                styles.chapterItem,
                { borderBottomColor: theme.colors.divider },
              ]}
              onPress={() => handleChapterPress(chapter)}
            >
              <Text
                style={[
                  styles.chapterTitle,
                  {
                    color: chapter.isRead
                      ? theme.colors.textSecondary
                      : theme.colors.text,
                  },
                ]}
              >
                {chapter.title}
              </Text>
              <TouchableOpacity
                onPress={() => console.log("Download chapter", chapter.id)}
              >
                <Ionicons
                  name={
                    chapter.isDownloaded
                      ? "checkmark-circle"
                      : "download-outline"
                  }
                  size={20}
                  color={
                    chapter.isDownloaded
                      ? theme.colors.success
                      : theme.colors.textSecondary
                  }
                />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <PopupMenu
        visible={isDownloadMenuVisible}
        onClose={() => setIsDownloadMenuVisible(false)}
        items={downloadOptions}
      />

      <PopupMenu
        visible={isMoreMenuVisible}
        onClose={() => setIsMoreMenuVisible(false)}
        items={moreOptions}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  iconButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  headerSection: {
    flexDirection: "row",
    padding: 16,
  },
  cover: {
    borderRadius: 8,
  },
  headerInfo: {
    flex: 1,
    marginLeft: 16,
    justifyContent: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
  },
  author: {
    fontSize: 14,
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  source: {
    fontSize: 12,
  },
  actionButtons: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  actionButtonText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "bold",
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 8,
  },
  summary: {
    fontSize: 14,
    lineHeight: 20,
  },
  genresContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  genreTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  genreText: {
    fontSize: 12,
  },
  progressSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  progressInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  progressText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  chapterCount: {
    fontSize: 12,
  },
  chapterItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  chapterTitle: {
    fontSize: 14,
    flex: 1,
  },
});
