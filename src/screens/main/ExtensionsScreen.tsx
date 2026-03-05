import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { useNavigation } from "@react-navigation/native";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Header } from "../../components/common/Header";
import { PopupMenu } from "../../components/common/PopupMenu";
import { useSettings } from "../../context/SettingsContext";
import { useTheme } from "../../context/ThemeContext";
import type { MainDrawerNavigationProp } from "../../navigation/navigationTypes";
import { ExtensionsService } from "../../services/extensions";
import type { ExtensionRepoPlugin } from "../../types";

type RepoPlugin = ExtensionRepoPlugin & { repoUrl: string };
type SortOption = "az" | "za" | "installed";

const safeHost = (site: string): string => {
  try {
    return new URL(site).host;
  } catch {
    return site;
  }
};

export const ExtensionsScreen: React.FC = () => {
  const navigation = useNavigation<MainDrawerNavigationProp>();
  const { theme } = useTheme();
  const {
    settings,
    addExtensionRepository,
    removeExtensionRepository,
    installExtensionPlugin,
    uninstallExtensionPlugin,
    setExtensionPluginEnabled,
  } = useSettings();

  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("az");
  const [isFilterMenuVisible, setIsFilterMenuVisible] = useState(false);
  const [isRepoModalVisible, setIsRepoModalVisible] = useState(false);
  const [newRepoUrl, setNewRepoUrl] = useState("");

  const [plugins, setPlugins] = useState<RepoPlugin[]>([]);
  const [repoFetchStatus, setRepoFetchStatus] = useState<
    Record<string, { fetchedAt?: string; error?: string }>
  >({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [installingIds, setInstallingIds] = useState<Record<string, boolean>>(
    {},
  );

  const repositories = useMemo(
    () => settings.extensions.repositories || [],
    [settings.extensions.repositories],
  );
  const installed = useMemo(
    () => settings.extensions.installedPlugins || {},
    [settings.extensions.installedPlugins],
  );

  const upsertRepoPlugins = (repoUrl: string, next: ExtensionRepoPlugin[]) => {
    setPlugins((prev) => {
      const filtered = prev.filter((p) => p.repoUrl !== repoUrl);
      return [...filtered, ...next.map((p) => ({ ...p, repoUrl }))];
    });
  };

  const loadCached = async () => {
    const status: Record<string, { fetchedAt?: string; error?: string }> = {};
    const cachedPlugins: RepoPlugin[] = [];

    for (const repoUrl of repositories) {
      const normalized = ExtensionsService.normalizeRepoUrl(repoUrl);
      try {
        const cached = await ExtensionsService.loadCachedRepoIndex(normalized);
        if (cached?.plugins?.length) {
          cachedPlugins.push(
            ...cached.plugins.map((p) => ({ ...p, repoUrl: normalized })),
          );
          status[normalized] = { fetchedAt: cached.fetchedAt };
        } else {
          status[normalized] = {};
        }
      } catch (e: any) {
        status[normalized] = { error: e?.message || "Failed to load cache" };
      }
    }

    setRepoFetchStatus(status);
    if (cachedPlugins.length) setPlugins(cachedPlugins);
  };

  const refreshAll = async () => {
    if (repositories.length === 0) return;
    setIsRefreshing(true);
    const statusUpdates: Record<string, { fetchedAt?: string; error?: string }> =
      {};

    await Promise.all(
      repositories.map(async (repoUrl) => {
        const normalized = ExtensionsService.normalizeRepoUrl(repoUrl);
        try {
          const cache = await ExtensionsService.fetchRepoIndex(normalized);
          upsertRepoPlugins(normalized, cache.plugins);
          statusUpdates[normalized] = { fetchedAt: cache.fetchedAt };
        } catch (e: any) {
          statusUpdates[normalized] = {
            error: e?.message || "Failed to fetch repo index",
          };
        }
      }),
    );

    setRepoFetchStatus((prev) => ({ ...prev, ...statusUpdates }));
    setIsRefreshing(false);
  };

  useEffect(() => {
    loadCached();
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repositories.join("|")]);

  const displayedPlugins = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? plugins.filter((p) => {
          return (
            p.name.toLowerCase().includes(q) ||
            p.id.toLowerCase().includes(q) ||
            p.lang.toLowerCase().includes(q) ||
            p.site.toLowerCase().includes(q)
          );
        })
      : plugins;

    const withInstalledPriority = [...filtered].sort((a, b) => {
      const aInstalled = Boolean(installed[a.id]);
      const bInstalled = Boolean(installed[b.id]);
      if (aInstalled !== bInstalled) return aInstalled ? -1 : 1;
      return 0;
    });

    if (sortOption === "installed") {
      return withInstalledPriority.sort((a, b) => a.name.localeCompare(b.name));
    }

    return withInstalledPriority.sort((a, b) => {
      if (sortOption === "az") return a.name.localeCompare(b.name);
      return b.name.localeCompare(a.name);
    });
  }, [installed, plugins, searchQuery, sortOption]);

  const handleAddRepo = async () => {
    const normalized = ExtensionsService.normalizeRepoUrl(newRepoUrl);
    if (!normalized) return;
    if (!/^https?:\/\//i.test(normalized)) {
      Alert.alert("Invalid URL", "Repository URL must start with http(s)://");
      return;
    }
    await addExtensionRepository(normalized);
    setNewRepoUrl("");
  };

  const handleRemoveRepo = async (repoUrl: string) => {
    Alert.alert("Remove repository?", repoUrl, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => removeExtensionRepository(repoUrl),
      },
    ]);
  };

  const handleInstallToggle = async (plugin: RepoPlugin) => {
    const isInstalled = Boolean(installed[plugin.id]);
    setInstallingIds((prev) => ({ ...prev, [plugin.id]: true }));
    try {
      if (isInstalled) {
        const localPath = installed[plugin.id]?.localPath;
        await ExtensionsService.deletePluginFile(localPath);
        await uninstallExtensionPlugin(plugin.id);
        return;
      }

      const localPath = await ExtensionsService.downloadPluginFile(
        plugin.id,
        plugin.url,
      );
      await installExtensionPlugin(
        plugin.repoUrl,
        plugin,
        localPath || undefined,
      );

      if (!localPath) {
        Alert.alert(
          "Installed",
          "Plugin metadata saved, but file download is not supported on this platform.",
        );
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to install/uninstall plugin.");
    } finally {
      setInstallingIds((prev) => ({ ...prev, [plugin.id]: false }));
    }
  };

  const renderPlugin = ({ item }: { item: RepoPlugin }) => {
    const installedPlugin = installed[item.id];
    const isInstalled = Boolean(installedPlugin);
    const isEnabled = installedPlugin?.enabled ?? false;
    const isBusy = Boolean(installingIds[item.id]);

    return (
      <View
        style={[
          styles.extensionItem,
          { backgroundColor: theme.colors.surface },
        ]}
      >
        <View
          style={[styles.iconContainer, { backgroundColor: theme.colors.border }]}
        >
          {item.iconUrl ? (
            <Image source={{ uri: item.iconUrl }} style={styles.icon} />
          ) : (
            <Ionicons name="cube" size={22} color={theme.colors.textSecondary} />
          )}
        </View>

        <View style={styles.extensionInfo}>
          <Text style={[styles.extensionName, { color: theme.colors.text }]}>
            {item.name}
          </Text>
          <Text
            style={[styles.extensionMeta, { color: theme.colors.textSecondary }]}
          >
            v{item.version} • {item.lang.toUpperCase()} • {safeHost(item.site)}
          </Text>
          <Text
            style={[styles.extensionSubMeta, { color: theme.colors.textSecondary }]}
            numberOfLines={1}
          >
            {item.repoUrl}
          </Text>
        </View>

        <View style={styles.actionsContainer}>
          {isInstalled && (
            <Switch
              value={isEnabled}
              onValueChange={(v) => setExtensionPluginEnabled(item.id, v)}
              trackColor={{
                false: theme.colors.border,
                true: theme.colors.primary,
              }}
            />
          )}
          <TouchableOpacity
            style={[
              styles.actionButton,
              {
                backgroundColor: isInstalled
                  ? theme.colors.error
                  : theme.colors.primary,
                opacity: isBusy ? 0.7 : 1,
              },
            ]}
            onPress={() => handleInstallToggle(item)}
            disabled={isBusy}
          >
            {isBusy ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.actionButtonText}>
                {isInstalled ? "Remove" : "Install"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const filterMenuItems = [
    { id: "az", label: "A-Z", onPress: () => setSortOption("az") },
    { id: "za", label: "Z-A", onPress: () => setSortOption("za") },
    {
      id: "installed",
      label: "Installed first",
      onPress: () => setSortOption("installed"),
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Header
        title="Extensions"
        onMenuPress={() => navigation.openDrawer()}
        isSearchActive={isSearchActive}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={() => setIsSearchActive(true)}
        onSearchClose={() => {
          setIsSearchActive(false);
          setSearchQuery("");
        }}
        rightButtons={
          !isSearchActive ? (
            <>
              <TouchableOpacity
                onPress={() => setIsSearchActive(true)}
                style={styles.iconButton}
              >
                <Ionicons name="search" size={24} color={theme.colors.text} />
              </TouchableOpacity>
              <TouchableOpacity onPress={refreshAll} style={styles.iconButton}>
                <Ionicons name="refresh" size={24} color={theme.colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setIsRepoModalVisible(true)}
                style={styles.iconButton}
              >
                <Ionicons name="link" size={24} color={theme.colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setIsFilterMenuVisible(true)}
                style={styles.iconButton}
              >
                <Ionicons name="filter" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </>
          ) : null
        }
      />

      {repositories.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
            No repositories
          </Text>
          <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
            Add an extension repository to browse and install plugins.
          </Text>
          <TouchableOpacity
            onPress={() => setIsRepoModalVisible(true)}
            style={[styles.emptyButton, { backgroundColor: theme.colors.primary }]}
          >
            <Text style={styles.emptyButtonText}>Add repository</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlashList
          data={displayedPlugins}
          renderItem={renderPlugin}
          keyExtractor={(item) => `${item.repoUrl}:${item.id}`}
          contentContainerStyle={styles.listContent}
          refreshing={isRefreshing}
          onRefresh={refreshAll}
          ListHeaderComponent={
            <View style={styles.repoSummary}>
              <Text style={[styles.repoSummaryText, { color: theme.colors.text }]}>
                {Object.keys(installed).length} installed • {repositories.length} repos •{" "}
                {plugins.length} plugins
              </Text>
              {repositories.map((r) => {
                const s = repoFetchStatus[r];
                if (!s?.error) return null;
                return (
                  <Text
                    key={`err:${r}`}
                    style={[styles.repoError, { color: theme.colors.error }]}
                    numberOfLines={2}
                  >
                    {r}: {s.error}
                  </Text>
                );
              })}
            </View>
          }
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={Platform.OS === "android"}
        />
      )}

      <PopupMenu
        visible={isFilterMenuVisible}
        onClose={() => setIsFilterMenuVisible(false)}
        items={filterMenuItems.map((item) => ({
          ...item,
          onPress: () => {
            item.onPress();
            setIsFilterMenuVisible(false);
          },
        }))}
      />

      <Modal
        visible={isRepoModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsRepoModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                Repositories
              </Text>
              <TouchableOpacity onPress={() => setIsRepoModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.addRepoRow}>
              <TextInput
                value={newRepoUrl}
                onChangeText={setNewRepoUrl}
                placeholder="https://.../plugins.min.json"
                placeholderTextColor={theme.colors.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                style={[
                  styles.repoInput,
                  { color: theme.colors.text, borderColor: theme.colors.border },
                ]}
              />
              <TouchableOpacity
                onPress={handleAddRepo}
                style={[styles.addRepoButton, { backgroundColor: theme.colors.primary }]}
              >
                <Ionicons name="add" size={22} color="#FFF" />
              </TouchableOpacity>
            </View>

            <FlashList
              data={repositories}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <View style={[styles.repoRow, { borderBottomColor: theme.colors.divider }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.colors.text }} numberOfLines={2}>
                      {item}
                    </Text>
                    {repoFetchStatus[item]?.fetchedAt && (
                      <Text
                        style={[styles.repoFetchedAt, { color: theme.colors.textSecondary }]}
                      >
                        Cached:{" "}
                        {new Date(repoFetchStatus[item].fetchedAt!).toLocaleString()}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => handleRemoveRepo(item)}
                    style={styles.repoRemoveButton}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={22}
                      color={theme.colors.error}
                    />
                  </TouchableOpacity>
                </View>
              )}
              contentContainerStyle={{ paddingBottom: 8 }}
              showsVerticalScrollIndicator={false}
              removeClippedSubviews={Platform.OS === "android"}
            />

            <TouchableOpacity
              onPress={() => {
                setIsRepoModalVisible(false);
                refreshAll();
              }}
              style={[styles.modalFooterButton, { backgroundColor: theme.colors.primary }]}
            >
              <Text style={styles.modalFooterButtonText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  iconButton: { padding: 8 },
  listContent: { padding: 16 },
  repoSummary: { marginBottom: 12, gap: 6 },
  repoSummaryText: { fontSize: 12, fontWeight: "600" },
  repoError: { fontSize: 12 },
  extensionItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    marginBottom: 8,
    borderRadius: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    overflow: "hidden",
  },
  icon: { width: 44, height: 44 },
  extensionInfo: { flex: 1 },
  extensionName: { fontSize: 16, fontWeight: "bold" },
  extensionMeta: { fontSize: 12, marginTop: 4 },
  extensionSubMeta: { fontSize: 11, marginTop: 4 },
  actionsContainer: { alignItems: "flex-end", justifyContent: "center", gap: 8 },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
    minWidth: 88,
    alignItems: "center",
  },
  actionButtonText: { color: "#FFF", fontSize: 14, fontWeight: "bold" },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 10,
  },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptySubtitle: { fontSize: 13, textAlign: "center" },
  emptyButton: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  emptyButtonText: { color: "#FFF", fontWeight: "700" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 16,
    justifyContent: "center",
  },
  modalCard: { borderRadius: 12, overflow: "hidden", maxHeight: "85%" },
  modalHeader: {
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: { fontSize: 16, fontWeight: "800" },
  addRepoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 10,
  },
  repoInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  addRepoButton: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  repoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  repoFetchedAt: { marginTop: 4, fontSize: 11 },
  repoRemoveButton: { padding: 8 },
  modalFooterButton: {
    margin: 16,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalFooterButtonText: { color: "#FFF", fontWeight: "800" },
});
