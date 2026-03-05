// src/screens/DownloadQueueScreen.tsx
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React, { useMemo } from "react";
import {
    ActivityIndicator,
    Alert,
    SectionList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { Header } from "../components/common/Header";
import { useDownloadQueue, type DownloadTask } from "../context/DownloadQueueContext";
import { useTheme } from "../context/ThemeContext";

type DownloadSection = {
  pluginId: string;
  title: string;
  data: DownloadTask[];
};

const statusLabel = (task: DownloadTask) => {
  switch (task.status) {
    case "pending":
      return "pending";
    case "downloading":
      return "downloading";
    case "completed":
      return "completed";
    case "canceled":
      return "canceled";
    case "error":
      return "error";
    default:
      return String(task.status);
  }
};

const statusSort = (status: DownloadTask["status"]) => {
  switch (status) {
    case "downloading":
      return 0;
    case "pending":
      return 1;
    case "error":
      return 2;
    case "completed":
      return 3;
    case "canceled":
      return 4;
    default:
      return 10;
  }
};

export const DownloadQueueScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { tasks, paused, togglePaused, cancelTask, cancelNovelTasks, retryTask, clearFinished } =
    useDownloadQueue();

  const sections = useMemo<DownloadSection[]>(() => {
    const grouped = new Map<string, DownloadSection>();
    for (const task of tasks) {
      const pluginId = task.pluginId || "unknown";
      const title = task.pluginName || pluginId;
      const section = grouped.get(pluginId) || { pluginId, title, data: [] };
      section.data.push(task);
      grouped.set(pluginId, section);
    }

    return Array.from(grouped.values())
      .map((s) => ({
        ...s,
        data: s.data
          .slice()
          .sort(
            (a, b) =>
              statusSort(a.status) - statusSort(b.status) ||
              a.createdAt - b.createdAt,
          ),
      }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [tasks]);

  const renderItem = ({ item }: { item: DownloadTask }) => {
    const showCancel =
      item.status === "pending" || item.status === "downloading" || item.status === "error";
    const showCompleted = item.status === "completed";

    return (
      <View style={[styles.item, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.itemHeader}>
          <View style={styles.itemInfo}>
            <Text style={[styles.novelTitle, { color: theme.colors.text }]} numberOfLines={1}>
              {item.novelTitle}
            </Text>
            <Text
              style={[styles.chapterTitle, { color: theme.colors.textSecondary }]}
              numberOfLines={1}
            >
              {item.chapterTitle}
            </Text>
          </View>

          {item.status === "error" ? (
            <TouchableOpacity
              onPress={() => retryTask(item.id)}
              style={styles.actionBtn}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
              <Ionicons name="refresh" size={18} color={theme.colors.primary} />
            </TouchableOpacity>
          ) : showCancel ? (
            <TouchableOpacity
              key={`cancel-${item.id}`}
              onPress={() => {
                Alert.alert(
                  "Cancel download",
                  "Cancel this chapter or cancel all downloads for this novel?",
                  [
                    { text: "Keep", style: "cancel" },
                    { text: "Cancel chapter", style: "destructive", onPress: () => cancelTask(item.id) },
                    { text: "Cancel novel", style: "destructive", onPress: () => cancelNovelTasks(item.novelId) },
                  ],
                );
              }}
              style={styles.actionBtn}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
              <Ionicons name="close" size={18} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          ) : showCompleted ? (
            <TouchableOpacity
              key={`remove-${item.id}`}
              onPress={() => {
                Alert.alert(
                  "Download Complete",
                  "This chapter has been downloaded successfully. What would you like to do?",
                  [
                    { text: "Keep", style: "cancel" },
                    { text: "Remove from queue", style: "destructive", onPress: () => cancelTask(item.id) },
                  ],
                );
              }}
              style={styles.actionBtn}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
              <Ionicons name="checkmark-circle" size={18} color={theme.colors.primary} />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { backgroundColor: theme.colors.border }]}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor:
                    item.status === "error" ? theme.colors.error : theme.colors.primary,
                  width: `${Math.max(0, Math.min(100, item.progress))}%`,
                },
              ]}
            />
          </View>
          <View style={styles.statusRight}>
            {item.status === "downloading" ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : null}
            <Text style={[styles.statusText, { color: theme.colors.textSecondary }]}>
              {item.status === "downloading"
                ? statusLabel(item)
                : item.status === "error" && item.errorMessage
                  ? "error"
                  : statusLabel(item)}
            </Text>
          </View>
        </View>

        {item.status === "error" && item.errorMessage ? (
          <Text style={[styles.errorText, { color: theme.colors.error }]} numberOfLines={2}>
            {item.errorMessage}
          </Text>
        ) : null}
      </View>
    );
  };

  return (
    <View key="download-queue-screen" style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Header
        title={paused ? "Download Queue (Paused)" : "Download Queue"}
        onBackPress={() => navigation.goBack()}
        rightButtons={[
          <TouchableOpacity
            key="toggle-paused"
            onPress={togglePaused}
            style={styles.iconButton}
          >
            <Ionicons
              name={paused ? "play" : "pause"}
              size={20}
              color={theme.colors.text}
            />
          </TouchableOpacity>,
          <TouchableOpacity 
            key="clear-completed"
            onPress={() => {
              Alert.alert(
                "Clear Completed",
                "Remove all completed downloads from the queue?",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Clear All",
                    style: "destructive",
                    onPress: () => clearFinished(),
                  },
                ],
              );
            }} 
            style={styles.iconButton}
          >
            <Ionicons name="trash" size={20} color={theme.colors.text} />
          </TouchableOpacity>,
        ]}
      />

      <SectionList<DownloadTask, DownloadSection>
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={({ section }) => (
          <View style={[styles.sectionHeader, { backgroundColor: theme.colors.background }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
              {section.title}
            </Text>
          </View>
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
              No downloads yet.
            </Text>
          </View>
        }
        stickySectionHeadersEnabled={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 28 },
  iconButton: {
    padding: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  sectionHeader: {
    paddingTop: 10,
    paddingBottom: 6,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  item: {
    padding: 14,
    marginBottom: 10,
    borderRadius: 10,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.16,
    shadowRadius: 1,
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  itemInfo: { flex: 1 },
  novelTitle: { fontSize: 15, fontWeight: "800" },
  chapterTitle: { fontSize: 13, marginTop: 2 },
  actionBtn: { padding: 6, borderRadius: 10 },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    gap: 10,
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: { height: "100%" },
  statusRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusText: { fontSize: 12, minWidth: 70, textAlign: "right" },
  errorText: { fontSize: 12, marginTop: 8 },
  empty: { paddingTop: 28, alignItems: "center" },
  emptyText: { fontSize: 13 },
});
