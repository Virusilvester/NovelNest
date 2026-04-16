import { useNavigation } from "@react-navigation/native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Header } from "../../components/common/Header";
import { ImprovedSwitch } from "../../components/common/ImprovedSwitch";
import { SelectionModal } from "../../components/common/SelectionModal";
import { SettingsRow, SettingsSection } from "../../components/settings/SettingsList";
import { START_SCREENS, UPDATE_FREQUENCIES } from "../../constants";
import { useDownloadQueue } from "../../context/DownloadQueueContext";
import { useLibrary } from "../../context/LibraryContext";
import { useSettings } from "../../context/SettingsContext";
import { useTheme } from "../../context/ThemeContext";
import { useUpdates } from "../../context/UpdatesContext";
import { AndroidProgressNotifications } from "../../services/androidProgressNotifications";
import { EpubImportService } from "../../services/epubImport";
import { getString } from "../../strings/translations";
import { StartScreen } from "../../types";

export const GeneralSettingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const {
    settings,
    updateGeneralSettings,
    updateAutoDownloadSettings,
    updateUpdatesSettings,
    setDownloadLocation,
  } = useSettings();
  const { novels, categories, addNovel } = useLibrary();
  const { enqueue } = useDownloadQueue();
  const {
    updates,
    lastCheckedAt,
    isChecking: isUpdateChecking,
    progress: updatesProgress,
    checkForUpdates,
    clearUpdates,
  } = useUpdates();

  const [showStartScreenModal, setShowStartScreenModal] = useState(false);
  const [showUpdateFrequencyModal, setShowUpdateFrequencyModal] =
    useState(false);
  const [isEpubImporting, setIsEpubImporting] = useState(false);
  const [epubImportText, setEpubImportText] = useState<string>("");
  const [epubImportProgress, setEpubImportProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);

  const handleSelectDownloadLocation = async () => {
    try {
      if (Platform.OS === "android" && FileSystem.StorageAccessFramework) {
        const perm =
          await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (perm.granted) await setDownloadLocation(perm.directoryUri);
        return;
      }
      Alert.alert(
        "Not supported",
        "Custom download location is only supported on Android.",
      );
    } catch (err) {
      console.error("Error selecting download location:", err);
    }
  };

  const getStartScreenLabel = (value: StartScreen) =>
    START_SCREENS.find((s) => s.value === value)?.label ?? "Library";

  const getUpdateFrequencyLabel = (value: string) =>
    UPDATE_FREQUENCIES.find((f) => f.value === value)?.label ?? "Daily";

  const downloadLocationLabel = !settings.general.downloadLocation
    ? "Internal (default)"
    : settings.general.downloadLocation.startsWith("content://")
      ? "Custom folder (Android)"
      : settings.general.downloadLocation;

  const defaultCategoryId = useMemo(() => {
    const list = Array.isArray(categories) ? categories : [];
    const choices = list
      .filter((c) => c && c.id && c.id !== "all")
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    if (choices.some((c) => c.id === "reading")) return "reading";
    return choices[0]?.id || "all";
  }, [categories]);

  const novelById = useMemo(() => {
    const map = new Map<string, (typeof novels)[number]>();
    for (const n of novels) map.set(n.id, n);
    return map;
  }, [novels]);

  const updatesStatusSubtitle = useMemo(() => {
    if (isUpdateChecking) {
      if (updatesProgress) {
        return `Checking ${updatesProgress.current}/${updatesProgress.total}`;
      }
      return "Checking...";
    }
    const label = lastCheckedAt
      ? new Date(lastCheckedAt).toLocaleString()
      : "Never";
    return `Last checked: ${label}`;
  }, [isUpdateChecking, lastCheckedAt, updatesProgress]);

  const handleCheckUpdatesNow = useCallback(async () => {
    if (isUpdateChecking) return;
    const result = await checkForUpdates({ force: true });
    const lines: string[] = [];
    lines.push(
      result.added > 0
        ? `Found ${result.added} new chapter(s).`
        : "No new chapters found.",
    );
    if (result.errors > 0) lines.push(`Errors: ${result.errors}.`);
    Alert.alert("Updates", lines.join("\n"));
  }, [checkForUpdates, isUpdateChecking]);

  const handleClearUpdatesList = useCallback(() => {
    if (isUpdateChecking) return;
    if (updates.length === 0) return;
    Alert.alert("Clear updates", "Remove all update entries?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: () => void clearUpdates(),
      },
    ]);
  }, [clearUpdates, isUpdateChecking, updates.length]);

  const handleDownloadAvailableUpdates = useCallback(() => {
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
      Alert.alert("Downloads", "No chapters to download.");
      return;
    }

    enqueue(tasks);
    Alert.alert("Downloads", `Queued ${tasks.length} chapter(s) for download.`);
  }, [enqueue, novelById, updates]);

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
      setEpubImportText("Preparing import...");
      setEpubImportProgress(null);
      AndroidProgressNotifications.setTask("epubImport", {
        title: "Importing EPUB",
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
            setEpubImportProgress({ current: p.current, total: p.total });
            setEpubImportText(p.text);
            AndroidProgressNotifications.setTask("epubImport", {
              title: "Importing EPUB",
              body: `${p.text}\n${p.current}/${p.total}`,
              progress: {
                current: p.current,
                max: p.total,
                indeterminate: false,
              },
            });
            return;
          }
          setEpubImportProgress(null);
          setEpubImportText(p.text);
          AndroidProgressNotifications.setTask("epubImport", {
            title: "Importing EPUB",
            body: p.text,
            progress: { indeterminate: true },
          });
        },
      });

      addNovel(novel);

      Alert.alert(
        "Import Complete",
        `"${novel.title}" was added to your library.`,
        [
          { text: "OK", style: "cancel" },
          {
            text: "Open",
            onPress: () =>
              (navigation as any).navigate("NovelDetail", {
                novelId: novel.id,
              }),
          },
        ],
      );
    } catch (e: any) {
      Alert.alert("Import Failed", e?.message || "Could not import EPUB.");
    } finally {
      AndroidProgressNotifications.clearTask("epubImport");
      setIsEpubImporting(false);
      setEpubImportText("");
      setEpubImportProgress(null);
    }
  }, [
    addNovel,
    defaultCategoryId,
    isEpubImporting,
    navigation,
    settings.general.language,
  ]);

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Header
        title={getString("settings.sections.general")}
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <SettingsSection>
          <SettingsRow
            icon="home-outline"
            label={getString("settings.general.startScreen")}
            subtitle={getStartScreenLabel(settings.general.startScreen)}
            onPress={() => setShowStartScreenModal(true)}
          />
          <SettingsRow
            icon="log-out-outline"
            label="Confirm exit on back"
            subtitle="Ask before closing the app"
            rightElement={
              <ImprovedSwitch
                value={settings.general.confirmExitOnBack}
                onValueChange={(v) =>
                  void updateGeneralSettings("confirmExitOnBack", v)
                }
              />
            }
          />
          <SettingsRow
            icon="folder-open-outline"
            label={getString("settings.general.downloadLocation")}
            subtitle={downloadLocationLabel}
            onPress={handleSelectDownloadLocation}
          />
          <SettingsRow
            icon="albums-outline"
            label="Categories"
            onPress={() => (navigation as any).navigate("EditCategories")}
          />
          <SettingsRow
            icon="alarm-outline"
            label="Update frequency"
            subtitle={getUpdateFrequencyLabel(settings.updates.frequency)}
            onPress={() => setShowUpdateFrequencyModal(true)}
          />
          <SettingsRow
            icon="git-branch-outline"
            label="Only update ongoing"
            rightElement={
              <ImprovedSwitch
                value={settings.updates.onlyUpdateOngoing}
                onValueChange={(v) =>
                  updateUpdatesSettings("onlyUpdateOngoing", v)
                }
              />
            }
          />
          <SettingsRow
            icon="refresh-outline"
            label="Check for updates now"
            subtitle={updatesStatusSubtitle}
            onPress={isUpdateChecking ? undefined : handleCheckUpdatesNow}
            rightElement={
              isUpdateChecking ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : undefined
            }
          />
          <SettingsRow
            icon="trash-outline"
            label="Clear updates list"
            subtitle={
              updates.length > 0 ? `${updates.length} entry(ies)` : "No entries"
            }
            onPress={
              updates.length > 0 && !isUpdateChecking
                ? handleClearUpdatesList
                : undefined
            }
            isDestructive
          />
          <SettingsRow
            icon="cloud-download-outline"
            label="Download new chapters"
            rightElement={
              <ImprovedSwitch
                value={settings.autoDownload.downloadNewChapters}
                onValueChange={(v) =>
                  updateAutoDownloadSettings("downloadNewChapters", v)
                }
              />
            }
          />
          <SettingsRow
            icon="download-outline"
            label="Download available updates"
            subtitle={
              updates.length > 0 ? `${updates.length} update(s)` : "No updates"
            }
            onPress={
              updates.length > 0 ? handleDownloadAvailableUpdates : undefined
            }
          />
          <SettingsRow
            icon="cloud-upload-outline"
            label="Import EPUB"
            subtitle="Add a local book from an EPUB file"
            onPress={
              isEpubImporting ? undefined : () => void handleImportEpub()
            }
            isLast
          />
        </SettingsSection>

        <View style={styles.bottomPad} />
      </ScrollView>

      <Modal
        visible={isEpubImporting}
        transparent
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={styles.importOverlay}>
          <View
            style={[
              styles.importCard,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.importTitle, { color: theme.colors.text }]}>
              Importing EPUB
            </Text>
            {epubImportText ? (
              <Text
                style={[
                  styles.importSubtitle,
                  { color: theme.colors.textSecondary },
                ]}
              >
                {epubImportText}
              </Text>
            ) : null}
            {epubImportProgress ? (
              <Text
                style={[
                  styles.importProgress,
                  { color: theme.colors.textSecondary },
                ]}
              >
                {epubImportProgress.current}/{epubImportProgress.total}
              </Text>
            ) : null}
          </View>
        </View>
      </Modal>

      <SelectionModal
        visible={showStartScreenModal}
        title="Select Start Screen"
        options={START_SCREENS}
        selectedValue={settings.general.startScreen}
        onSelect={(value) => {
          void updateGeneralSettings("startScreen", value as StartScreen);
          setShowStartScreenModal(false);
        }}
        onClose={() => setShowStartScreenModal(false)}
      />
      <SelectionModal
        visible={showUpdateFrequencyModal}
        title="Update Frequency"
        options={UPDATE_FREQUENCIES}
        selectedValue={settings.updates.frequency}
        onSelect={(value) => updateUpdatesSettings("frequency", value as any)}
        onClose={() => setShowUpdateFrequencyModal(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 32 },
  bottomPad: { height: 8 },

  // Import modal
  importOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  importCard: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    alignItems: "center",
    gap: 10,
  },
  importTitle: { fontSize: 16, fontWeight: "800", marginTop: 4 },
  importSubtitle: { fontSize: 12, fontWeight: "700", textAlign: "center" },
  importProgress: { fontSize: 12, fontWeight: "800" },
});
