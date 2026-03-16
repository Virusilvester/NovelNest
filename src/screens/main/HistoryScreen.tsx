// src/screens/main/HistoryScreen.tsx
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { FlashList } from "@shopify/flash-list";
import { format, isAfter, subDays } from "date-fns";
import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Header } from "../../components/common/Header";
import { useHistory } from "../../context/HistoryContext";
import { useTheme } from "../../context/ThemeContext";
import type { MainDrawerNavigationProp } from "../../navigation/navigationTypes";
import { getString, t } from "../../strings/translations";
import { HistoryEntry } from "../../types";

type HistoryGroup = {
  title: string;
  data: HistoryEntry[];
};

const groupHistoryEntriesByDate = (entries: HistoryEntry[]): HistoryGroup[] => {
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
    if (!groups[key]) groups[key] = [];
    groups[key].push(entry);
  });
  return Object.entries(groups).map(([title, data]) => ({ title, data }));
};

const formatReadingTime = (minutes: number): string => {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24)
    return remainingMinutes > 0
      ? `${hours}h ${remainingMinutes}m`
      : `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
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

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return historyEntries;
    return historyEntries.filter(
      (e) =>
        e.novel.title.toLowerCase().includes(q) ||
        e.novel.author.toLowerCase().includes(q),
    );
  }, [historyEntries, searchQuery]);

  const groupedEntries = useMemo(
    () => groupHistoryEntriesByDate(filteredEntries),
    [filteredEntries],
  );

  const handleCoverPress = useCallback(
    (entry: HistoryEntry) =>
      navigation.navigate("NovelDetail", { novelId: entry.novel.id }),
    [navigation],
  );

  const handleResumePress = useCallback(
    (entry: HistoryEntry) =>
      navigation.navigate("Reader", {
        novelId: entry.novel.id,
        chapterId: entry.lastReadChapter.id,
      }),
    [navigation],
  );

  const handleRemovePress = useCallback(
    (entry: HistoryEntry) => {
      Alert.alert(
        getString("history.remove.title"),
        t("history.remove.body", { title: entry.novel.title }),
        [
          { text: getString("common.cancel"), style: "cancel" },
          {
            text: getString("history.remove.action"),
            style: "destructive",
            onPress: () => removeFromHistory(entry.id),
          },
        ],
      );
    },
    [removeFromHistory],
  );

  const renderHistoryItem = ({ item: entry }: { item: HistoryEntry }) => (
    <View
      style={[styles.historyItem, { backgroundColor: theme.colors.surface }]}
    >
      {/* Cover */}
      <TouchableOpacity
        style={styles.coverContainer}
        onPress={() => handleCoverPress(entry)}
        activeOpacity={0.85}
      >
        <Image
          source={{ uri: entry.novel.coverUrl }}
          style={styles.cover}
          resizeMode="cover"
        />
        {/* Progress pill overlaid on cover bottom */}
        <View
          style={[
            styles.coverBadge,
            { backgroundColor: theme.colors.primary + "E8" },
          ]}
        >
          <Text style={styles.coverBadgeText}>
            {Math.round(entry.progress)}%
          </Text>
        </View>
      </TouchableOpacity>

      {/* Info */}
      <View style={styles.infoContainer}>
        <TouchableOpacity onPress={() => handleCoverPress(entry)}>
          <Text
            style={[styles.novelTitle, { color: theme.colors.text }]}
            numberOfLines={2}
          >
            {entry.novel.title}
          </Text>
        </TouchableOpacity>

        <View style={styles.chapterRow}>
          <Ionicons
            name="bookmark-outline"
            size={12}
            color={theme.colors.primary}
          />
          <Text
            style={[styles.chapterInfo, { color: theme.colors.textSecondary }]}
            numberOfLines={1}
          >
            {"  "}Ch.{entry.lastReadChapter.number}:{" "}
            {entry.lastReadChapter.title}
          </Text>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaPill}>
            <Ionicons
              name="time-outline"
              size={11}
              color={theme.colors.textSecondary}
            />
            <Text
              style={[styles.metaText, { color: theme.colors.textSecondary }]}
            >
              {" "}
              {formatReadingTime(entry.timeSpentReading)}
            </Text>
          </View>
          <View style={styles.metaPill}>
            <Ionicons
              name="layers-outline"
              size={11}
              color={theme.colors.textSecondary}
            />
            <Text
              style={[styles.metaText, { color: theme.colors.textSecondary }]}
            >
              {" "}
              {entry.totalChaptersRead}/{entry.novel.totalChapters}
            </Text>
          </View>
        </View>

        {/* Progress bar */}
        <View style={styles.progressBarWrap}>
          <View
            style={[
              styles.progressBarTrack,
              { backgroundColor: theme.colors.border },
            ]}
          >
            <View
              style={[
                styles.progressBarFill,
                {
                  backgroundColor:
                    entry.progress >= 100
                      ? theme.colors.success
                      : theme.colors.primary,
                  width: `${Math.min(100, entry.progress)}%`,
                },
              ]}
            />
          </View>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actionCol}>
        <TouchableOpacity
          style={[styles.resumeBtn, { backgroundColor: theme.colors.primary }]}
          onPress={() => handleResumePress(entry)}
        >
          <Ionicons name="play" size={13} color="#FFF" />
          <Text style={styles.resumeBtnText}>Resume</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.removeBtn,
            { backgroundColor: theme.colors.error + "18" },
          ]}
          onPress={() => handleRemovePress(entry)}
        >
          <Ionicons name="trash-outline" size={16} color={theme.colors.error} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderItem = ({ item }: { item: HistoryGroup | HistoryEntry }) => {
    if ("title" in item && "data" in item) {
      return (
        <View
          style={[
            styles.sectionHeader,
            { backgroundColor: theme.colors.background },
          ]}
        >
          <Ionicons
            name="calendar-outline"
            size={12}
            color={theme.colors.textSecondary}
          />
          <Text
            style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}
          >
            {"  "}
            {(item as HistoryGroup).title}
          </Text>
        </View>
      );
    }
    return renderHistoryItem({ item: item as HistoryEntry });
  };

  const listData = useMemo(() => {
    const out: (HistoryGroup | HistoryEntry)[] = [];
    groupedEntries.forEach((group) => {
      out.push(group);
      group.data.forEach((entry) => out.push(entry));
    });
    return out;
  }, [groupedEntries]);

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Header
        title={getString("screens.history.title")}
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
              style={styles.iconBtn}
            >
              <Ionicons
                name="search-outline"
                size={22}
                color={theme.colors.text}
              />
            </TouchableOpacity>
          ) : undefined
        }
      />

      {/* Stats bar */}
      {historyEntries.length > 0 && (
        <View
          style={[
            styles.statsBar,
            {
              backgroundColor: theme.colors.surface,
              borderBottomColor: theme.colors.border,
            },
          ]}
        >
          <View style={styles.statItem}>
            <Ionicons
              name="library-outline"
              size={16}
              color={theme.colors.primary}
            />
            <Text style={[styles.statValue, { color: theme.colors.text }]}>
              {" "}
              {historyEntries.length}
            </Text>
            <Text
              style={[styles.statLabel, { color: theme.colors.textSecondary }]}
            >
              {" "}
              novels
            </Text>
          </View>
          <View
            style={[
              styles.statDivider,
              { backgroundColor: theme.colors.border },
            ]}
          />
          <View style={styles.statItem}>
            <Ionicons
              name="checkmark-circle-outline"
              size={16}
              color={theme.colors.primary}
            />
            <Text style={[styles.statValue, { color: theme.colors.text }]}>
              {" "}
              {getTotalChaptersRead()}
            </Text>
            <Text
              style={[styles.statLabel, { color: theme.colors.textSecondary }]}
            >
              {" "}
              chapters
            </Text>
          </View>
          <View
            style={[
              styles.statDivider,
              { backgroundColor: theme.colors.border },
            ]}
          />
          <View style={styles.statItem}>
            <Ionicons
              name="hourglass-outline"
              size={16}
              color={theme.colors.primary}
            />
            <Text style={[styles.statValue, { color: theme.colors.text }]}>
              {" "}
              {formatReadingTime(getTotalReadingTime())}
            </Text>
            <Text
              style={[styles.statLabel, { color: theme.colors.textSecondary }]}
            >
              {" "}
              read
            </Text>
          </View>
        </View>
      )}

      {historyEntries.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View
            style={[
              styles.emptyIconWrap,
              { backgroundColor: theme.colors.surface },
            ]}
          >
            <Ionicons
              name="time-outline"
              size={48}
              color={theme.colors.textSecondary}
            />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
            No reading history
          </Text>
          <Text
            style={[
              styles.emptySubtitle,
              { color: theme.colors.textSecondary },
            ]}
          >
            Start reading a novel and it will appear here
          </Text>
        </View>
      ) : (
        <FlashList
          data={listData}
          renderItem={renderItem}
          keyExtractor={(item, index) => {
            if ("title" in item && "data" in item)
              return `section-${(item as HistoryGroup).title}`;
            return `entry-${(item as HistoryEntry).id}`;
          }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={Platform.OS === "android"}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  iconBtn: { padding: 8 },

  // Stats
  statsBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  statItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: { fontSize: 14, fontWeight: "700" },
  statLabel: { fontSize: 13 },
  statDivider: { width: StyleSheet.hairlineWidth, height: 20 },

  // List
  listContent: { padding: 16, paddingBottom: 28 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },

  // History card
  historyItem: {
    flexDirection: "row",
    padding: 12,
    marginBottom: 10,
    borderRadius: 14,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    gap: 12,
  },
  coverContainer: { position: "relative" },
  cover: {
    width: 66,
    height: 98,
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
  },
  coverBadge: {
    position: "absolute",
    bottom: 4,
    left: 4,
    right: 4,
    borderRadius: 4,
    paddingVertical: 2,
    alignItems: "center",
  },
  coverBadgeText: { color: "#FFF", fontSize: 10, fontWeight: "700" },

  infoContainer: {
    flex: 1,
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  novelTitle: {
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 19,
    marginBottom: 4,
  },
  chapterRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  chapterInfo: { fontSize: 12, flex: 1 },
  metaRow: { flexDirection: "row", gap: 10, marginBottom: 8 },
  metaPill: { flexDirection: "row", alignItems: "center" },
  metaText: { fontSize: 11 },
  progressBarWrap: {},
  progressBarTrack: { height: 3, borderRadius: 999, overflow: "hidden" },
  progressBarFill: { height: "100%", borderRadius: 999 },

  actionCol: {
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingVertical: 2,
  },
  resumeBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  resumeBtnText: { color: "#FFF", fontSize: 12, fontWeight: "700" },
  removeBtn: { padding: 7, borderRadius: 8 },

  // Empty
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
    gap: 12,
  },
  emptyIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  emptyTitle: { fontSize: 18, fontWeight: "800" },
  emptySubtitle: { fontSize: 14, textAlign: "center", lineHeight: 20 },
});
