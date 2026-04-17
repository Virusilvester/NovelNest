// src/screens/main/UpdatesScreen.tsx
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { FlashList } from "@shopify/flash-list";
import React, { useCallback, useMemo } from "react";
import {
  Alert,
  Image,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Header } from "../../components/common/Header";
import { useDownloadQueue } from "../../context/DownloadQueueContext";
import { useLibrary } from "../../context/LibraryContext";
import { useTheme } from "../../context/ThemeContext";
import { useUpdates, type UpdateEntry } from "../../context/UpdatesContext";
import type { MainDrawerNavigationProp } from "../../navigation/navigationTypes";
import { getString, t } from "../../strings/translations";

export const UpdatesScreen: React.FC = () => {
  const navigation = useNavigation<MainDrawerNavigationProp>();
  const { theme } = useTheme();
  const { novels } = useLibrary();
  const { enqueue } = useDownloadQueue();
  const {
    updates,
    isChecking,
    progress,
    lastCheckedAt,
    checkForUpdates,
    clearUpdates,
  } = useUpdates();

  const novelById = useMemo(() => {
    const map = new Map<string, (typeof novels)[number]>();
    for (const n of novels) map.set(n.id, n);
    return map;
  }, [novels]);

  const handleRefresh = useCallback(() => {
    void checkForUpdates({ force: true });
  }, [checkForUpdates]);

  const handleClearUpdates = useCallback(() => {
    if (updates.length === 0) return;
    Alert.alert(getString("updates.clear.title"), getString("updates.clear.body"), [
      { text: getString("common.cancel"), style: "cancel" },
      {
        text: getString("updates.clear.action"),
        style: "destructive",
        onPress: () => void clearUpdates(),
      },
    ]);
  }, [clearUpdates, updates.length]);

  const handleDownloadAll = useCallback(() => {
    if (updates.length === 0) return;
    const tasks = updates.flatMap((u) => {
      const novel = novelById.get(u.novelId);
      if (!novel?.pluginId) return [];
      if (novel.chapterDownloaded?.[u.chapterPath]) return [];
      return [
        {
          pluginId: u.pluginId,
          pluginName: u.pluginName,
          novelId: u.novelId,
          novelTitle: u.novelTitle,
          chapterPath: u.chapterPath,
          chapterTitle: u.chapterTitle,
        },
      ];
    });

    if (tasks.length === 0) {
      Alert.alert(
        getString("downloads.title"),
        getString("updates.download.noneNew"),
      );
      return;
    }

    enqueue(tasks);
    Alert.alert(
      getString("downloads.title"),
      t("downloads.queuedChapters", { count: tasks.length }),
    );
  }, [enqueue, novelById, updates]);

  const renderUpdateItem = useCallback(
    ({ item }: { item: UpdateEntry }) => {
      const novel = novelById.get(item.novelId);
      const downloaded = Boolean(novel?.chapterDownloaded?.[item.chapterPath]);

      return (
        <TouchableOpacity
          style={[styles.updateItem, { backgroundColor: theme.colors.surface }]}
          activeOpacity={0.8}
          onPress={() => {
             if (!novel) {
               Alert.alert(
                 getString("updates.notFound.title"),
                 getString("updates.notFound.body"),
               );
               return;
             }
            navigation.navigate("Reader", {
              novelId: item.novelId,
              chapterId: item.chapterPath,
            });
          }}
        >
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              if (!novel) {
                Alert.alert(
                  getString("updates.notFound.title"),
                  getString("updates.notFound.body"),
                );
                return;
              }
              navigation.navigate("NovelDetail", { novelId: item.novelId });
            }}
          >
            {item.novelCoverUrl ? (
              <Image
                source={{ uri: item.novelCoverUrl }}
                style={styles.cover}
                resizeMode="cover"
              />
            ) : (
              <View
                style={[
                  styles.coverPlaceholder,
                  { backgroundColor: theme.colors.border },
                ]}
              >
                <Ionicons
                  name="book-outline"
                  size={22}
                  color={theme.colors.textSecondary}
                />
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.updateInfo}>
            <Text
              style={[styles.updateTitle, { color: theme.colors.text }]}
              numberOfLines={1}
            >
              {item.novelTitle}
            </Text>
            <View style={styles.updateMeta}>
              <Ionicons
                name="sparkles-outline"
                size={12}
                color={theme.colors.primary}
              />
              <Text
                style={[
                  styles.updateMetaText,
                  { color: theme.colors.textSecondary },
                ]}
                numberOfLines={2}
              >
                {" "}
                {item.chapterTitle}
              </Text>
            </View>
            {!!item.releaseTime && (
              <Text
                style={[
                  styles.updateTime,
                  { color: theme.colors.textSecondary },
                ]}
                numberOfLines={1}
              >
                {item.releaseTime}
              </Text>
            )}
          </View>

          <TouchableOpacity
            onPress={() => {
              if (!novel?.pluginId) return;
              if (downloaded) return;
              enqueue({
                pluginId: item.pluginId,
                pluginName: item.pluginName,
                novelId: item.novelId,
                novelTitle: item.novelTitle,
                chapterPath: item.chapterPath,
                chapterTitle: item.chapterTitle,
              });
            }}
            style={styles.iconBtn}
            disabled={!novel?.pluginId || downloaded}
            hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
          >
            <Ionicons
              name={downloaded ? "checkmark-circle" : "download-outline"}
              size={20}
              color={
                downloaded ? theme.colors.success : theme.colors.textSecondary
              }
            />
          </TouchableOpacity>
        </TouchableOpacity>
      );
    },
    [enqueue, navigation, novelById, theme.colors],
  );

  const listHeader = useMemo(() => {
    if (progress) {
      return (
        <View
          style={[styles.progressBar, { backgroundColor: theme.colors.surface }]}
        >
          <Ionicons name="sync-outline" size={16} color={theme.colors.primary} />
          <Text
            style={[styles.progressText, { color: theme.colors.textSecondary }]}
          >
            Checking {progress.current}/{progress.total}
          </Text>
        </View>
      );
    }

    if (lastCheckedAt) {
      const d = new Date(lastCheckedAt);
      return (
        <View
          style={[styles.progressBar, { backgroundColor: theme.colors.surface }]}
        >
          <Ionicons
            name="time-outline"
            size={16}
            color={theme.colors.textSecondary}
          />
          <Text
            style={[styles.progressText, { color: theme.colors.textSecondary }]}
          >
            {t("updates.lastChecked", { date: d.toLocaleString() })}
          </Text>
        </View>
      );
    }

    return null;
  }, [
    lastCheckedAt,
    progress,
    theme.colors.primary,
    theme.colors.surface,
    theme.colors.textSecondary,
  ]);

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Header
        title={getString("screens.updates.title")}
        onMenuPress={() => navigation.openDrawer()}
        rightButtons={
          <>
            <TouchableOpacity
              onPress={handleDownloadAll}
              style={styles.iconBtn}
              disabled={updates.length === 0}
            >
              <Ionicons
                name="download-outline"
                size={22}
                color={
                  updates.length === 0
                    ? theme.colors.textSecondary
                    : theme.colors.text
                }
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleClearUpdates}
              style={styles.iconBtn}
              disabled={updates.length === 0 || isChecking}
            >
              <Ionicons
                name="trash-outline"
                size={22}
                color={
                  updates.length === 0 || isChecking
                    ? theme.colors.textSecondary
                    : theme.colors.text
                }
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleRefresh}
              style={styles.iconBtn}
              disabled={isChecking}
            >
              <Ionicons
                name="refresh-outline"
                size={22}
                color={isChecking ? theme.colors.textSecondary : theme.colors.text}
              />
            </TouchableOpacity>
          </>
        }
      />

      {updates.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View
            style={[
              styles.emptyIconWrap,
              { backgroundColor: theme.colors.surface },
            ]}
          >
            <Ionicons
              name="newspaper-outline"
              size={48}
              color={theme.colors.textSecondary}
            />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
            All caught up!
          </Text>
          <Text
            style={[
              styles.emptySubtitle,
              { color: theme.colors.textSecondary },
            ]}
          >
            {lastCheckedAt
              ? "No new chapter updates found."
              : "No updates yet. Check for updates to get started."}
            {"\n"}
            Pull down to check again.
          </Text>
          <TouchableOpacity
            style={[styles.checkBtn, { backgroundColor: theme.colors.primary }]}
            onPress={handleRefresh}
            disabled={isChecking}
          >
            <Ionicons name="refresh-outline" size={16} color="#FFF" />
            <Text style={styles.checkBtnText}>
              {isChecking ? "Checking..." : "Check for updates"}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlashList
          data={updates}
          keyExtractor={(item) => item.id}
          renderItem={renderUpdateItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={Platform.OS === "android"}
          refreshControl={
            <RefreshControl
              refreshing={isChecking}
              onRefresh={handleRefresh}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
            />
          }
          ListHeaderComponent={listHeader}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  iconBtn: { padding: 8 },
  listContent: { padding: 16, paddingBottom: 28 },

  progressBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 10,
  },
  progressText: { fontSize: 12, fontWeight: "600" },

  updateItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    marginBottom: 10,
    borderRadius: 14,
    gap: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  cover: { width: 46, height: 68, borderRadius: 7 },
  coverPlaceholder: {
    width: 46,
    height: 68,
    borderRadius: 7,
    justifyContent: "center",
    alignItems: "center",
  },
  updateInfo: { flex: 1 },
  updateTitle: { fontSize: 14, fontWeight: "700", marginBottom: 4 },
  updateMeta: { flexDirection: "row", alignItems: "center" },
  updateMetaText: { fontSize: 12, flex: 1 },
  updateTime: { fontSize: 11, marginTop: 4 },

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
  emptyTitle: { fontSize: 20, fontWeight: "800" },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 22,
    opacity: 0.7,
  },
  checkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  checkBtnText: { color: "#FFF", fontWeight: "700", fontSize: 14 },
});
