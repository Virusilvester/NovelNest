// src/screens/main/HistoryScreen.tsx
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { format, isAfter, subDays } from "date-fns";
import React, { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Header } from "../../components/common/Header";
import { useHistory } from "../../context/HistoryContext";
import { useTheme } from "../../context/ThemeContext";
import type { MainDrawerNavigationProp } from "../../navigation/navigationTypes";
import { HistoryEntry } from "../../types";

// Group entries by time period
type HistoryGroup = {
  title: string;
  data: HistoryEntry[];
};

export const HistoryScreen: React.FC = () => {
  const navigation = useNavigation<MainDrawerNavigationProp>();
  const { theme } = useTheme();
  const {
    historyEntries,
    removeFromHistory,
    getTotalReadingTime,
    getTotalChaptersRead,
  } = useHistory();

  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Filter entries based on search
  const filteredEntries = searchQuery
    ? historyEntries.filter(
        (entry) =>
          entry.novel.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          entry.novel.author.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : historyEntries;

  // Group entries by date
  const groupEntriesByDate = (entries: HistoryEntry[]): HistoryGroup[] => {
    const groups: { [key: string]: HistoryEntry[] } = {};

    entries.forEach((entry) => {
      const date = entry.lastReadDate;
      const now = new Date();
      const sevenDaysAgo = subDays(now, 7);

      let key: string;
      if (isAfter(date, subDays(now, 1))) {
        key = "Today";
      } else if (isAfter(date, subDays(now, 2))) {
        key = "Yesterday";
      } else if (isAfter(date, sevenDaysAgo)) {
        const daysDiff = Math.floor(
          (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
        );
        key = `${daysDiff} days ago`;
      } else {
        key = format(date, "MMM d, yyyy");
      }

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(entry);
    });

    return Object.entries(groups).map(([title, data]) => ({ title, data }));
  };

  const groupedEntries = groupEntriesByDate(filteredEntries);

  const handleCoverPress = useCallback(
    (entry: HistoryEntry) => {
      navigation.navigate("NovelDetail", { novelId: entry.novel.id });
    },
    [navigation],
  );

  const handleResumePress = useCallback(
    (entry: HistoryEntry) => {
      navigation.navigate("Reader", {
        novelId: entry.novel.id,
        chapterId: entry.lastReadChapter.id,
      });
    },
    [navigation],
  );

  const handleRemovePress = useCallback(
    (entry: HistoryEntry) => {
      Alert.alert(
        "Remove from History",
        `Remove "${entry.novel.title}" from your reading history?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: () => removeFromHistory(entry.id),
          },
        ],
      );
    },
    [removeFromHistory],
  );

  const formatReadingTime = (minutes: number): string => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (hours < 24) return `${hours}h ${remainingMinutes}m`;
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  };

  const renderHistoryItem = ({ item: entry }: { item: HistoryEntry }) => (
    <View
      style={[styles.historyItem, { backgroundColor: theme.colors.surface }]}
    >
      {/* Clickable Cover */}
      <TouchableOpacity
        style={styles.coverContainer}
        onPress={() => handleCoverPress(entry)}
        activeOpacity={0.8}
      >
        <Image
          source={{ uri: entry.novel.coverUrl }}
          style={styles.cover}
          resizeMode="cover"
        />
        {/* Progress overlay on cover */}
        <View style={styles.progressOverlay}>
          <Text style={styles.progressText}>{entry.progress.toFixed(1)}%</Text>
        </View>
      </TouchableOpacity>

      {/* Info Section */}
      <View style={styles.infoContainer}>
        <TouchableOpacity onPress={() => handleCoverPress(entry)}>
          <Text
            style={[styles.novelTitle, { color: theme.colors.text }]}
            numberOfLines={2}
          >
            {entry.novel.title}
          </Text>
        </TouchableOpacity>

        <Text
          style={[styles.chapterInfo, { color: theme.colors.textSecondary }]}
        >
          Ch. {entry.lastReadChapter.number}: {entry.lastReadChapter.title}
        </Text>

        <View style={styles.readingTimeRow}>
          <Ionicons
            name="time-outline"
            size={12}
            color={theme.colors.textSecondary}
          />
          <Text
            style={[styles.readingTime, { color: theme.colors.textSecondary }]}
          >
            {"  "}
            {formatReadingTime(entry.timeSpentReading)}
          </Text>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressBarContainer}>
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
                  backgroundColor:
                    entry.progress === 100
                      ? theme.colors.success
                      : theme.colors.primary,
                  width: `${entry.progress}%`,
                },
              ]}
            />
          </View>
          <Text
            style={[
              styles.progressLabel,
              { color: theme.colors.textSecondary },
            ]}
          >
            {entry.totalChaptersRead}/{entry.novel.totalChapters}
          </Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionContainer}>
        <TouchableOpacity
          style={[
            styles.resumeButton,
            { backgroundColor: theme.colors.primary },
          ]}
          onPress={() => handleResumePress(entry)}
        >
          <Ionicons name="play" size={16} color="#FFF" />
          <Text style={styles.resumeButtonText}>Resume</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.removeButton,
            { backgroundColor: theme.colors.error + "20" },
          ]}
          onPress={() => handleRemovePress(entry)}
        >
          <Ionicons name="trash-outline" size={18} color={theme.colors.error} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSectionHeader = ({
    section: { title },
  }: {
    section: HistoryGroup;
  }) => (
    <View
      style={[
        styles.sectionHeader,
        { backgroundColor: theme.colors.background },
      ]}
    >
      <Text
        style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}
      >
        {title}
      </Text>
    </View>
  );

  // Flatten data for FlatList with section headers
  const renderItem = ({
    item,
    index,
  }: {
    item: HistoryGroup | HistoryEntry;
    index: number;
  }) => {
    // Check if it's a section header (has 'title' and 'data')
    if ("title" in item && "data" in item) {
      return renderSectionHeader({ section: item as HistoryGroup });
    }
    return renderHistoryItem({ item: item as HistoryEntry });
  };

  // Prepare data with section headers interleaved
  const listData: (HistoryGroup | HistoryEntry)[] = [];
  groupedEntries.forEach((group) => {
    listData.push(group);
    group.data.forEach((entry) => listData.push(entry));
  });

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons
        name="time-outline"
        size={80}
        color={theme.colors.textSecondary}
      />
      <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
        No Reading History
      </Text>
      <Text
        style={[styles.emptySubtext, { color: theme.colors.textSecondary }]}
      >
        Start reading novels to see them here
      </Text>
    </View>
  );

  const renderStats = () => (
    <View
      style={[styles.statsContainer, { backgroundColor: theme.colors.surface }]}
    >
      <View style={styles.statItem}>
        <Text style={[styles.statValue, { color: theme.colors.primary }]}>
          {historyEntries.length}
        </Text>
        <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
          Novels
        </Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Text style={[styles.statValue, { color: theme.colors.primary }]}>
          {getTotalChaptersRead()}
        </Text>
        <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
          Chapters
        </Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Text style={[styles.statValue, { color: theme.colors.primary }]}>
          {formatReadingTime(getTotalReadingTime())}
        </Text>
        <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
          Reading Time
        </Text>
      </View>
    </View>
  );

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Header
        title="History"
        onMenuPress={() => navigation.openDrawer()}
        isSearchActive={isSearchActive}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={() => {}}
        onSearchClose={() => {
          setIsSearchActive(false);
          setSearchQuery("");
        }}
        rightButtons={
          !isSearchActive ? (
            <TouchableOpacity
              onPress={() => setIsSearchActive(true)}
              style={styles.iconButton}
            >
              <Ionicons name="search" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          ) : undefined
        }
      />

      {historyEntries.length > 0 && renderStats()}

      {historyEntries.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={listData}
          renderItem={renderItem}
          keyExtractor={(item, index) => {
            if ("title" in item && "data" in item) {
              return `section-${item.title}`;
            }
            return `entry-${(item as HistoryEntry).id}`;
          }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
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
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 16,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "bold",
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: "rgba(0,0,0,0.1)",
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
  },
  sectionHeader: {
    paddingVertical: 8,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  historyItem: {
    flexDirection: "row",
    padding: 12,
    marginBottom: 12,
    borderRadius: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  coverContainer: {
    position: "relative",
  },
  cover: {
    width: 70,
    height: 105,
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
  },
  progressOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingVertical: 4,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  progressText: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "bold",
    textAlign: "center",
  },
  infoContainer: {
    flex: 1,
    marginLeft: 12,
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  novelTitle: {
    fontSize: 15,
    fontWeight: "bold",
    lineHeight: 20,
  },
  chapterInfo: {
    fontSize: 12,
    marginTop: 2,
  },
  readingTime: {
    fontSize: 11,
    marginTop: 4,
  },
  readingTimeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  progressBarContainer: {
    marginTop: 8,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  progressLabel: {
    fontSize: 11,
    marginTop: 4,
  },
  actionContainer: {
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginLeft: 8,
    paddingVertical: 2,
  },
  resumeButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  resumeButtonText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "bold",
    marginLeft: 4,
  },
  removeButton: {
    padding: 6,
    borderRadius: 6,
    marginTop: "auto",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
});
