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
import { getString, t } from "../strings/translations";

type DownloadSection = {
  pluginId: string;
  title: string;
  data: DownloadTask[];
};

const STATUS_CONFIG: Record<
  DownloadTask["status"],
  { icon: keyof typeof Ionicons.glyphMap; color: (theme: any) => string }
> = {
  pending: { icon: "time-outline", color: (t) => t.colors.textSecondary },
  downloading: { icon: "cloud-download-outline", color: (t) => t.colors.primary },
  completed: { icon: "checkmark-circle-outline", color: (t) => t.colors.success },
  canceled: { icon: "close-circle-outline", color: (t) => t.colors.textSecondary },
  error: { icon: "alert-circle-outline", color: (t) => t.colors.error },
};

const statusSort = (s: DownloadTask["status"]) =>
  ({ downloading: 0, pending: 1, error: 2, completed: 3, canceled: 4 }[s] ?? 10);

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
      const section = grouped.get(pluginId) ?? { pluginId, title, data: [] };
      section.data.push(task);
      grouped.set(pluginId, section);
    }
    return Array.from(grouped.values())
      .map((s) => ({
        ...s,
        data: s.data.slice().sort(
          (a, b) => statusSort(a.status) - statusSort(b.status) || a.createdAt - b.createdAt,
        ),
      }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [tasks]);

  // Aggregate counts for header pill
  const counts = useMemo(() => {
    const c = { downloading: 0, pending: 0, error: 0, completed: 0, canceled: 0 };
    tasks.forEach((t) => { if (t.status in c) (c as any)[t.status]++; });
    return c;
  }, [tasks]);

  const renderItem = ({ item }: { item: DownloadTask }) => {
    const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.pending;
    const statusColor = cfg.color(theme);
    const isActive = item.status === "pending" || item.status === "downloading";
    const isError = item.status === "error";
    const isDone = item.status === "completed";

    return (
      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        {/* Top row: title + action */}
        <View style={styles.cardTop}>
          <View style={[styles.statusDot, { backgroundColor: statusColor + "30" }]}>
            {item.status === "downloading" ? (
              <ActivityIndicator size="small" color={statusColor} />
            ) : (
              <Ionicons name={cfg.icon} size={16} color={statusColor} />
            )}
          </View>

          <View style={styles.cardInfo}>
            <Text style={[styles.novelTitle, { color: theme.colors.text }]} numberOfLines={1}>
              {item.novelTitle}
            </Text>
            <Text style={[styles.chapterTitle, { color: theme.colors.textSecondary }]} numberOfLines={1}>
              {item.chapterTitle}
            </Text>
          </View>

          {isError && (
            <TouchableOpacity
              onPress={() => retryTask(item.id)}
              style={[styles.actionBtn, { backgroundColor: theme.colors.primary + "18" }]}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
              <Ionicons name="refresh-outline" size={16} color={theme.colors.primary} />
            </TouchableOpacity>
          )}
          {isActive && (
            <TouchableOpacity
              onPress={() =>
                Alert.alert(
                  getString("downloadQueue.alerts.cancelTitle"),
                  getString("downloadQueue.alerts.cancelMessage"),
                  [
                    { text: getString("downloadQueue.alerts.keep"), style: "cancel" },
                    {
                      text: getString("downloadQueue.alerts.cancelChapter"),
                      style: "destructive",
                      onPress: () => cancelTask(item.id),
                    },
                    {
                      text: getString("downloadQueue.alerts.cancelNovel"),
                      style: "destructive",
                      onPress: () => cancelNovelTasks(item.novelId),
                    },
                  ],
                )
              }
              style={[styles.actionBtn, { backgroundColor: theme.colors.border }]}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
              <Ionicons name="close" size={16} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          )}
          {isDone && (
            <TouchableOpacity
              onPress={() => cancelTask(item.id)}
              style={[styles.actionBtn, { backgroundColor: theme.colors.success + "18" }]}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
              <Ionicons name="checkmark" size={16} color={theme.colors.success} />
            </TouchableOpacity>
          )}
        </View>

        {/* Progress bar */}
        <View style={styles.progressRow}>
          <View style={[styles.progressTrack, { backgroundColor: theme.colors.border }]}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: isError ? theme.colors.error : isDone ? theme.colors.success : theme.colors.primary,
                  width: `${Math.max(0, Math.min(100, item.progress))}%`,
                },
              ]}
            />
          </View>
          <Text style={[styles.progressPct, { color: theme.colors.textSecondary }]}>
            {Math.round(item.progress)}%
          </Text>
        </View>

        {/* Error message */}
        {isError && item.errorMessage ? (
          <View style={[styles.errorBanner, { backgroundColor: theme.colors.error + "12" }]}>
            <Ionicons name="alert-circle-outline" size={13} color={theme.colors.error} />
            <Text style={[styles.errorText, { color: theme.colors.error }]} numberOfLines={2}>
              {" "}{item.errorMessage}
            </Text>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Header
        title={
          paused
            ? getString("screens.downloadQueue.pausedTitle")
            : getString("screens.downloadQueue.title")
        }
        onBackPress={() => navigation.goBack()}
        rightButtons={[
          <TouchableOpacity key="toggle" onPress={togglePaused} style={styles.iconBtn}>
            <Ionicons
              name={paused ? "play-circle-outline" : "pause-circle-outline"}
              size={24}
              color={paused ? theme.colors.primary : theme.colors.text}
            />
          </TouchableOpacity>,
          <TouchableOpacity
            key="clear"
            onPress={() =>
              Alert.alert(
                getString("downloadQueue.alerts.clearTitle"),
                getString("downloadQueue.alerts.clearMessage"),
                [
                  { text: getString("common.cancel"), style: "cancel" },
                  {
                    text: getString("downloadQueue.alerts.clear"),
                    style: "destructive",
                    onPress: () => clearFinished(),
                  },
                ],
              )
            }
            style={styles.iconBtn}
          >
            <Ionicons name="trash-outline" size={20} color={theme.colors.text} />
          </TouchableOpacity>,
        ]}
      />

      {/* Status summary strip */}
      {tasks.length > 0 && (
        <View style={[styles.summaryStrip, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          {counts.downloading > 0 && (
            <View style={styles.stripItem}>
              <Ionicons name="cloud-download-outline" size={13} color={theme.colors.primary} />
              <Text style={[styles.stripText, { color: theme.colors.primary }]}>
                {" "}
                {t("downloadQueue.summary.active", { count: counts.downloading })}
              </Text>
            </View>
          )}
          {counts.pending > 0 && (
            <View style={styles.stripItem}>
              <Ionicons name="time-outline" size={13} color={theme.colors.textSecondary} />
              <Text style={[styles.stripText, { color: theme.colors.textSecondary }]}>
                {" "}
                {t("downloadQueue.summary.queued", { count: counts.pending })}
              </Text>
            </View>
          )}
          {counts.error > 0 && (
            <View style={styles.stripItem}>
              <Ionicons name="alert-circle-outline" size={13} color={theme.colors.error} />
              <Text style={[styles.stripText, { color: theme.colors.error }]}>
                {" "}
                {t("downloadQueue.summary.failed", { count: counts.error })}
              </Text>
            </View>
          )}
          {counts.completed > 0 && (
            <View style={styles.stripItem}>
              <Ionicons name="checkmark-circle-outline" size={13} color={theme.colors.success} />
              <Text style={[styles.stripText, { color: theme.colors.success }]}>
                {" "}
                {t("downloadQueue.summary.done", { count: counts.completed })}
              </Text>
            </View>
          )}
        </View>
      )}

      <SectionList<DownloadTask, DownloadSection>
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={({ section }) => (
          <View style={[styles.sectionHeader, { backgroundColor: theme.colors.background }]}>
            <Ionicons name="cube-outline" size={13} color={theme.colors.textSecondary} />
            <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
              {"  "}{section.title}
            </Text>
          </View>
        )}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconWrap, { backgroundColor: theme.colors.surface }]}>
              <Ionicons name="cloud-done-outline" size={48} color={theme.colors.textSecondary} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
              {getString("downloadQueue.empty.title")}
            </Text>
            <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
              {getString("downloadQueue.empty.subtitle")}
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  iconBtn: { padding: 8 },
  listContent: { padding: 16, paddingBottom: 28 },

  summaryStrip: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stripItem: { flexDirection: "row", alignItems: "center" },
  stripText: { fontSize: 12, fontWeight: "600" },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 6,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  card: {
    padding: 14,
    marginBottom: 10,
    borderRadius: 14,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    gap: 10,
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  statusDot: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  cardInfo: { flex: 1 },
  novelTitle: { fontSize: 14, fontWeight: "700", marginBottom: 2 },
  chapterTitle: { fontSize: 12 },
  actionBtn: { width: 34, height: 34, borderRadius: 9, justifyContent: "center", alignItems: "center" },

  progressRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  progressTrack: { flex: 1, height: 4, borderRadius: 999, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 999 },
  progressPct: { fontSize: 11, fontWeight: "600", minWidth: 34, textAlign: "right" },

  errorBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 8,
    borderRadius: 8,
  },
  errorText: { fontSize: 12, flex: 1, lineHeight: 16 },

  emptyContainer: { paddingTop: 60, alignItems: "center", gap: 12 },
  emptyIconWrap: { width: 96, height: 96, borderRadius: 24, justifyContent: "center", alignItems: "center", marginBottom: 8 },
  emptyTitle: { fontSize: 18, fontWeight: "800" },
  emptySubtitle: { fontSize: 14, textAlign: "center", opacity: 0.7 },
});
