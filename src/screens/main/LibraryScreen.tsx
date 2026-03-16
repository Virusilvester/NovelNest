// src/screens/main/LibraryScreen.tsx
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import * as DocumentPicker from "expo-document-picker";
import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { FilterPanel } from "../../components/common/FilterPanel";
import { Header } from "../../components/common/Header";
import { PopupMenu } from "../../components/common/PopupMenu";
import { CategoryTabs } from "../../components/library/CategoryTabs";
import { NovelGrid } from "../../components/library/NovelGrid";
import { useLibrary } from "../../context/LibraryContext";
import { useSettings } from "../../context/SettingsContext";
import { useTheme } from "../../context/ThemeContext";
import { useUpdates } from "../../context/UpdatesContext";
import type { MainDrawerNavigationProp } from "../../navigation/navigationTypes";
import { AndroidProgressNotifications } from "../../services/androidProgressNotifications";
import { EpubImportService } from "../../services/epubImport";
import { getString, t } from "../../strings/translations";
import { Novel } from "../../types";

export const LibraryScreen: React.FC = () => {
  const navigation = useNavigation<MainDrawerNavigationProp>();
  const { theme } = useTheme();
  const { settings } = useSettings();
  const {
    categories,
    selectedCategoryId,
    selectCategory,
    filterOptions,
    setFilterOptions,
    sortOption,
    setSortOption,
    displayMode,
    setDisplayMode,
    showDownloadBadges,
    setShowDownloadBadges,
    showUnreadBadges,
    setShowUnreadBadges,
    showItemCount,
    setShowItemCount,
    getFilteredNovels,
    novels,
    addNovel,
    updateNovel,
    removeNovel,
  } = useLibrary();
  const { checkForUpdates, isChecking: isUpdateChecking } = useUpdates();

  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isFilterPanelVisible, setIsFilterPanelVisible] = useState(false);
  const [isMenuVisible, setIsMenuVisible] = useState(false);

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [isSelectionMenuVisible, setIsSelectionMenuVisible] = useState(false);
  const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false);
  const [pendingCategoryId, setPendingCategoryId] = useState<string | null>(
    null,
  );

  const filteredNovels = useMemo(
    () => getFilteredNovels(),
    [getFilteredNovels],
  );

  const displayedNovels = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return filteredNovels;
    return filteredNovels.filter(
      (n) =>
        n.title.toLowerCase().includes(q) || n.author.toLowerCase().includes(q),
    );
  }, [filteredNovels, searchQuery]);

  const clearSelection = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedIds(new Set());
    setIsSelectionMenuVisible(false);
    setIsCategoryModalVisible(false);
    setPendingCategoryId(null);
  }, []);

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (next.size === 0) {
        setIsSelectionMode(false);
        setIsSelectionMenuVisible(false);
        setIsCategoryModalVisible(false);
        setPendingCategoryId(null);
      }
      return next;
    });
  }, []);

  const handleNovelPress = useCallback(
    (novel: Novel) => {
      if (isSelectionMode) {
        toggleSelected(novel.id);
        return;
      }
      navigation.navigate("NovelDetail", { novelId: novel.id });
    },
    [isSelectionMode, navigation, toggleSelected],
  );

  const handleNovelLongPress = useCallback(
    (novel: Novel) => {
      if (!isSelectionMode) {
        setIsSelectionMode(true);
        setSelectedIds(new Set([novel.id]));
        setIsSearchActive(false);
        setIsFilterPanelVisible(false);
        setIsMenuVisible(false);
        return;
      }
      toggleSelected(novel.id);
    },
    [isSelectionMode, toggleSelected],
  );

  const handleUpdateLibrary = useCallback(async () => {
    if (isUpdateChecking) return;
    const result = await checkForUpdates({ force: true });
    if (result.added > 0) {
      Alert.alert(
        getString("library.update.title"),
        t("library.update.foundNew", { count: result.added }),
        [
          { text: getString("common.ok") },
          {
            text: getString("library.update.viewUpdates"),
            onPress: () => navigation.navigate("Updates"),
          },
        ],
      );
      return;
    }
    const base =
      result.checked > 0
        ? getString("library.update.noneFound")
        : getString("library.update.nothingToUpdate");
    const extra =
      result.errors > 0
        ? `\n\n${t("library.update.errors", { count: result.errors })}`
        : "";
    Alert.alert(getString("library.update.title"), base + extra);
  }, [checkForUpdates, isUpdateChecking, navigation]);

  const defaultCategoryId = useMemo(() => {
    if (selectedCategoryId && selectedCategoryId !== "all") return selectedCategoryId;
    const list = Array.isArray(categories) ? categories : [];
    const choices = list
      .filter((c) => c && c.id && c.id !== "all")
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    if (choices.some((c) => c.id === "reading")) return "reading";
    return choices[0]?.id || "all";
  }, [categories, selectedCategoryId]);

  const [isEpubImporting, setIsEpubImporting] = useState(false);
  const handleImportEpub = useCallback(async () => {
    if (isEpubImporting) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/epub+zip", "application/octet-stream", "*/*"],
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      const asset = result.assets[0];
      const uri = asset.uri;
      const filename = String(asset.name || "book.epub");

      setIsEpubImporting(true);
      AndroidProgressNotifications.setTask("epubImport", {
        title: getString("epub.importingTitle"),
        body: filename,
        progress: { indeterminate: true },
      });

      const novel = await EpubImportService.importFromUri({
        uri,
        filename,
        defaultCategoryId,
        languageFallback: settings.general.language || "en",
        onProgress: (p) => {
          if (p.stage === "chapters") {
            AndroidProgressNotifications.setTask("epubImport", {
              title: getString("epub.importingTitle"),
              body: `${p.text}\n${p.current}/${p.total}`,
              progress: {
                current: p.current,
                max: p.total,
                indeterminate: false,
              },
            });
            return;
          }
          AndroidProgressNotifications.setTask("epubImport", {
            title: getString("epub.importingTitle"),
            body: p.text,
            progress: { indeterminate: true },
          });
        },
      });

      addNovel(novel);
      Alert.alert(
        getString("epub.importCompleteTitle"),
        t("epub.importAddedToLibrary", { title: novel.title }),
        [
          { text: getString("common.ok"), style: "cancel" },
          {
            text: getString("library.actions.open"),
            onPress: () =>
              (navigation as any).navigate("NovelDetail", { novelId: novel.id }),
          },
        ],
      );
    } catch (e: any) {
      Alert.alert(
        getString("library.import.failedTitle"),
        e?.message || getString("library.import.failedBody"),
      );
    } finally {
      AndroidProgressNotifications.clearTask("epubImport");
      setIsEpubImporting(false);
    }
  }, [
    addNovel,
    defaultCategoryId,
    isEpubImporting,
    navigation,
    settings.general.language,
  ]);

  const getItemCount = useCallback(
    (categoryId: string) => {
      if (categoryId === "all") return novels.length;
      return novels.filter((n) => n.categoryId === categoryId).length;
    },
    [novels],
  );

  const menuItems = [
    {
      id: "update",
      label: "Update library",
      onPress: handleUpdateLibrary,
    },
    {
      id: "importEpub",
      label: "Import EPUB",
      onPress: handleImportEpub,
    },
  ];

  const categoryChoices = useMemo(() => {
    const list = Array.isArray(categories) ? categories : [];
    return list
      .filter((c) => c && c.id && c.id !== "all")
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [categories]);

  const selectedNovels = useMemo(
    () => novels.filter((n) => selectedIds.has(n.id)),
    [novels, selectedIds],
  );

  const selectAllDisplayed = useCallback(() => {
    if (displayedNovels.length === 0) return;
    setIsSelectionMode(true);
    setSelectedIds(new Set(displayedNovels.map((n) => n.id)));
  }, [displayedNovels]);

  const invertSelection = useCallback(() => {
    setIsSelectionMode(true);
    setSelectedIds((prev) => {
      const next = new Set<string>();
      for (const n of displayedNovels) {
        if (!prev.has(n.id)) next.add(n.id);
      }
      if (next.size === 0) setIsSelectionMode(false);
      return next;
    });
  }, [displayedNovels]);

  const openCategoryModal = useCallback(() => {
    if (categoryChoices.length === 0) {
      Alert.alert("No categories", "Create a category first.");
      return;
    }
    const common =
      selectedNovels.length > 0
        ? selectedNovels.every(
            (n) => n.categoryId === selectedNovels[0].categoryId,
          )
          ? selectedNovels[0].categoryId
          : null
        : null;
    const initial =
      (common && categoryChoices.some((c) => c.id === common) && common) ||
      categoryChoices[0].id;
    setPendingCategoryId(initial);
    setIsCategoryModalVisible(true);
  }, [categoryChoices, selectedNovels]);

  const applyCategoryChange = useCallback(() => {
    if (!pendingCategoryId) return;
    selectedNovels.forEach((n) => {
      updateNovel(n.id, { categoryId: pendingCategoryId });
    });
    setIsCategoryModalVisible(false);
    clearSelection();
  }, [clearSelection, pendingCategoryId, selectedNovels, updateNovel]);

  const bulkDelete = useCallback(() => {
    if (selectedNovels.length === 0) return;
    Alert.alert(
      "Delete novels",
      `Delete ${selectedNovels.length} selected novel(s) from your library?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            selectedNovels.forEach((n) => removeNovel(n.id));
            clearSelection();
          },
        },
      ],
    );
  }, [clearSelection, removeNovel, selectedNovels]);

  const markSelectedRead = useCallback(() => {
    selectedNovels.forEach((n) => {
      const total = Math.max(0, n.totalChapters || 0);
      updateNovel(n.id, {
        unreadChapters: 0,
        lastReadChapter: total,
        lastReadDate: new Date(),
      });
    });
  }, [selectedNovels, updateNovel]);

  const markSelectedUnread = useCallback(() => {
    selectedNovels.forEach((n) => {
      const total = Math.max(0, n.totalChapters || 0);
      updateNovel(n.id, {
        unreadChapters: total,
        lastReadChapter: 0,
        lastReadDate: undefined,
      });
    });
  }, [selectedNovels, updateNovel]);

  const markSelectedDownloaded = useCallback(() => {
    selectedNovels.forEach((n) => updateNovel(n.id, { isDownloaded: true }));
  }, [selectedNovels, updateNovel]);

  const markSelectedUndownloaded = useCallback(() => {
    selectedNovels.forEach((n) => updateNovel(n.id, { isDownloaded: false }));
  }, [selectedNovels, updateNovel]);

  const selectionMenuItems = useMemo(
    () => [
      { id: "selectAll", label: "Select all", onPress: selectAllDisplayed },
      { id: "invert", label: "Select inverse", onPress: invertSelection },
      { id: "category", label: "Change category", onPress: openCategoryModal },
      { id: "read", label: "Mark as read", onPress: markSelectedRead },
      { id: "unread", label: "Mark as unread", onPress: markSelectedUnread },
      { id: "download", label: "Download", onPress: markSelectedDownloaded },
      {
        id: "removeDownloads",
        label: "Remove downloads",
        onPress: () => {
          markSelectedUndownloaded();
          clearSelection();
        },
      },
      {
        id: "delete",
        label: "Delete",
        isDestructive: true,
        onPress: bulkDelete,
      },
    ],
    [
      bulkDelete,
      clearSelection,
      invertSelection,
      markSelectedDownloaded,
      markSelectedRead,
      markSelectedUndownloaded,
      markSelectedUnread,
      openCategoryModal,
      selectAllDisplayed,
    ],
  );

  // Custom right buttons for header - ONLY ONE SEARCH BUTTON
  const headerRightButtons = (
    <>
      <TouchableOpacity
        onPress={() => setIsSearchActive(true)}
        style={styles.iconButton}
      >
        <Ionicons name="search" size={24} color={theme.colors.text} />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => setIsFilterPanelVisible(true)}
        style={styles.iconButton}
      >
        <Ionicons name="filter" size={24} color={theme.colors.text} />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => setIsMenuVisible(true)}
        style={styles.iconButton}
      >
        <Ionicons
          name="ellipsis-vertical"
          size={24}
          color={theme.colors.text}
        />
      </TouchableOpacity>
    </>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons
        name="book-outline"
        size={64}
        color={theme.colors.textSecondary}
      />
      <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
        No novels found
      </Text>
      <Text
        style={[styles.emptySubtext, { color: theme.colors.textSecondary }]}
      >
        {selectedCategoryId === "all"
          ? "Your library is empty"
          : "No novels in this category"}
      </Text>
    </View>
  );

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      {isSelectionMode ? (
        <Header
          title={`${selectedIds.size} selected`}
          onBackPress={clearSelection}
          rightButtons={
            <>
              <TouchableOpacity
                onPress={selectAllDisplayed}
                style={styles.iconButton}
              >
                <Ionicons
                  name="checkbox-outline"
                  size={24}
                  color={theme.colors.text}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={invertSelection}
                style={styles.iconButton}
              >
                <Ionicons
                  name="swap-horizontal"
                  size={24}
                  color={theme.colors.text}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setIsSelectionMenuVisible(true)}
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
      ) : (
        <Header
          title={getString("screens.library.title")}
          onMenuPress={() => navigation.openDrawer()}
          isSearchActive={isSearchActive}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSearchSubmit={() => {
            // Handle search submit if needed
          }}
          onSearchClose={() => {
            setIsSearchActive(false);
            setSearchQuery("");
          }}
          rightButtons={!isSearchActive ? headerRightButtons : undefined}
        />
      )}

      <View
        pointerEvents={isSelectionMode ? "none" : "auto"}
        style={{ opacity: isSelectionMode ? 0.6 : 1 }}
      >
        <CategoryTabs
          categories={categories}
          selectedId={selectedCategoryId}
          onSelect={selectCategory}
          getItemCount={getItemCount}
          showItemCount={showItemCount}
        />
      </View>

      {displayedNovels.length === 0 ? (
        renderEmptyState()
      ) : (
        <NovelGrid
          novels={displayedNovels}
          displayMode={displayMode}
          showDownloadBadges={showDownloadBadges}
          showUnreadBadges={showUnreadBadges}
          onNovelPress={handleNovelPress}
          onNovelLongPress={handleNovelLongPress}
          selectionMode={isSelectionMode}
          selectedIds={selectedIds}
        />
      )}

      <FilterPanel
        visible={!isSelectionMode && isFilterPanelVisible}
        onClose={() => setIsFilterPanelVisible(false)}
        filterOptions={filterOptions}
        onFilterChange={setFilterOptions}
        sortOption={sortOption}
        onSortChange={setSortOption}
        displayMode={displayMode}
        onDisplayModeChange={setDisplayMode}
        showDownloadBadges={showDownloadBadges}
        onShowDownloadBadgesChange={setShowDownloadBadges}
        showUnreadBadges={showUnreadBadges}
        onShowUnreadBadgesChange={setShowUnreadBadges}
        showItemCount={showItemCount}
        onShowItemCountChange={setShowItemCount}
      />

      <PopupMenu
        visible={!isSelectionMode && isMenuVisible}
        onClose={() => setIsMenuVisible(false)}
        items={menuItems}
      />

      <PopupMenu
        visible={isSelectionMenuVisible}
        onClose={() => setIsSelectionMenuVisible(false)}
        items={selectionMenuItems}
      />

      <Modal
        visible={isCategoryModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCategoryModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsCategoryModalVisible(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[
              styles.modalCard,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
            onPress={() => {}}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                Change category
              </Text>
              <Text
                style={[
                  styles.modalSubtitle,
                  { color: theme.colors.textSecondary },
                ]}
              >
                Select a category to move {selectedNovels.length} novel(s).
              </Text>
            </View>

            <View style={styles.modalList}>
              {categoryChoices.map((c) => {
                const selected = pendingCategoryId === c.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[
                      styles.modalRow,
                      { borderBottomColor: theme.colors.divider },
                      selected && {
                        backgroundColor: theme.colors.primary + "15",
                      },
                    ]}
                    onPress={() => setPendingCategoryId(c.id)}
                  >
                    <Text
                      style={[
                        styles.modalRowText,
                        { color: theme.colors.text },
                      ]}
                    >
                      {c.name}
                    </Text>
                    <Ionicons
                      name={selected ? "radio-button-on" : "radio-button-off"}
                      size={20}
                      color={
                        selected
                          ? theme.colors.primary
                          : theme.colors.textSecondary
                      }
                    />
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                  },
                ]}
                onPress={() => setIsCategoryModalVisible(false)}
              >
                <Text
                  style={[styles.modalButtonText, { color: theme.colors.text }]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={!pendingCategoryId}
                style={[
                  styles.modalButton,
                  {
                    backgroundColor: pendingCategoryId
                      ? theme.colors.primary
                      : theme.colors.border,
                    borderColor: "transparent",
                  },
                ]}
                onPress={applyCategoryChange}
              >
                <Text
                  style={[
                    styles.modalButtonText,
                    {
                      color: pendingCategoryId
                        ? "#FFF"
                        : theme.colors.textSecondary,
                    },
                  ]}
                >
                  Move
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  iconButton: {
    padding: 8,
    justifyContent: "center",
    alignItems: "center",
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    padding: 18,
    justifyContent: "center",
  },
  modalCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  modalHeader: {
    padding: 14,
    gap: 6,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  modalSubtitle: {
    fontSize: 12,
  },
  modalList: {
    maxHeight: 320,
  },
  modalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  modalRowText: {
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
    paddingRight: 12,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
  },
  modalButtonText: {
    fontWeight: "800",
  },
});
