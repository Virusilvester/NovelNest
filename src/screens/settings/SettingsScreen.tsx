// src/screens/settings/SettingsScreen.tsx
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Header } from "../../components/common/Header";
import { ImprovedSwitch } from "../../components/common/ImprovedSwitch";
import { SelectionModal } from "../../components/common/SelectionModal";
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

// ── Section wrapper ───────────────────────────────────────────────────────────

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => {
  const { theme } = useTheme();
  return (
    <View style={styles.section}>
      <Text
        style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}
      >
        {title}
      </Text>
      <View
        style={[
          styles.sectionCard,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
};

// ── Row variants ──────────────────────────────────────────────────────────────

interface RowProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  label: string;
  subtitle?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  isLast?: boolean;
  isDestructive?: boolean;
}

const Row: React.FC<RowProps> = ({
  icon,
  iconColor,
  label,
  subtitle,
  onPress,
  rightElement,
  isLast,
  isDestructive,
}) => {
  const { theme } = useTheme();
  const color = isDestructive
    ? theme.colors.error
    : (iconColor ?? theme.colors.primary);
  return (
    <TouchableOpacity
      style={[
        styles.row,
        !isLast && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.colors.divider,
        },
      ]}
      onPress={onPress}
      disabled={!onPress && !rightElement}
      activeOpacity={0.7}
    >
      <View style={[styles.rowIconWrap, { backgroundColor: color + "18" }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <View style={styles.rowContent}>
        <Text
          style={[
            styles.rowLabel,
            { color: isDestructive ? theme.colors.error : theme.colors.text },
          ]}
        >
          {label}
        </Text>
        {subtitle ? (
          <Text
            style={[styles.rowSubtitle, { color: theme.colors.textSecondary }]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {rightElement ??
        (onPress ? (
          <Ionicons
            name="chevron-forward"
            size={18}
            color={theme.colors.textSecondary}
          />
        ) : null)}
    </TouchableOpacity>
  );
};

// ---- Main screen ----

export const SettingsScreen: React.FC = () => {
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
      return "Checking…";
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
        title={getString("settings.title")}
        onBackPress={() => navigation.goBack()}
        rightButtons={
          <TouchableOpacity
            onPress={() => Linking.openURL("https://github.com/your-repo/wiki")}
            style={styles.iconBtn}
          >
            <Ionicons
              name="help-circle-outline"
              size={22}
              color={theme.colors.text}
            />
          </TouchableOpacity>
        }
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* General */}
        <Section title={getString("settings.sections.general")}>
          <Row
            icon="home-outline"
            label={getString("settings.general.startScreen")}
            subtitle={getStartScreenLabel(settings.general.startScreen)}
            onPress={() => setShowStartScreenModal(true)}
          />
          <Row
            icon="folder-open-outline"
            label={getString("settings.general.downloadLocation")}
            subtitle={downloadLocationLabel}
            onPress={handleSelectDownloadLocation}
          />
          <Row
            icon="albums-outline"
            label="Categories"
            onPress={() => navigation.navigate("EditCategories")}
          />
          <Row
            icon="alarm-outline"
            label="Update frequency"
            subtitle={getUpdateFrequencyLabel(settings.updates.frequency)}
            onPress={() => setShowUpdateFrequencyModal(true)}
          />
          <Row
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
          <Row
            icon="refresh-outline"
            label="Check for updates now"
            subtitle={updatesStatusSubtitle}
            onPress={isUpdateChecking ? undefined : handleCheckUpdatesNow}
          />
          <Row
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
          <Row
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
          <Row
            icon="download-outline"
            label="Download available updates"
            subtitle={
              updates.length > 0 ? `${updates.length} update(s)` : "No updates"
            }
            onPress={
              updates.length > 0 ? handleDownloadAvailableUpdates : undefined
            }
          />
          <Row
            icon="cloud-upload-outline"
            label="Import EPUB"
            subtitle="Add a local book from an EPUB file"
            onPress={
              isEpubImporting ? undefined : () => void handleImportEpub()
            }
            isLast
          />
        </Section>

        {/* Appearance */}
        <Section title={getString("settings.sections.appearance")}>
          <Row
            icon="color-palette-outline"
            label={getString("settings.sections.appearance")}
            subtitle={
              settings.display.theme === "system"
                ? getString("settings.appearance.themeSystem")
                : settings.display.theme === "dark"
                  ? getString("settings.appearance.themeDark")
                  : getString("settings.appearance.themeLight")
            }
            onPress={() => navigation.navigate("Appearance")}
            isLast
          />
        </Section>

        {/* Reader */}
        <Section title={getString("settings.sections.reader")}>
          <Row
            icon="settings-outline"
            label="General"
            onPress={() => navigation.navigate("ReaderSettings")}
          />
          <Row
            icon="color-palette-outline"
            label="Reader theme"
            onPress={() => navigation.navigate("ReaderTheme")}
          />
          <Row
            icon="mic-outline"
            label="Text to Speech"
            onPress={() => navigation.navigate("TTSSettings")}
            isLast
          />
        </Section>

        {/* Tracking */}
        <Section title={getString("settings.sections.tracking")}>
          <Row
            icon="analytics-outline"
            label="Services"
            onPress={() => navigation.navigate("TrackingServices")}
            isLast
          />
        </Section>

        {/* Backup */}
        <Section title={getString("settings.sections.backup")}>
          <Row
            icon="cloud-outline"
            label="Remote Backup"
            onPress={() => navigation.navigate("RemoteBackup")}
          />
          <Row
            icon="archive-outline"
            label="Legacy Backup"
            onPress={() => navigation.navigate("LegacyBackup")}
            isLast
          />
        </Section>

        {/* Advanced */}
        <Section title={getString("settings.sections.advanced")}>
          <Row
            icon="server-outline"
            label="Data Management"
            subtitle="Storage, cache, and user agent"
            onPress={() => navigation.navigate("DataManagement")}
            isLast
          />
        </Section>

        {/* About */}
        <Section title={getString("settings.sections.about")}>
          <Row
            icon="information-circle-outline"
            label="Version"
            subtitle="2.0.4-beta"
            isLast
          />
        </Section>

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
  iconBtn: { padding: 8 },
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

  section: { marginTop: 24, paddingHorizontal: 16 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12,
  },
  rowIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: "500" },
  rowSubtitle: { fontSize: 12, marginTop: 1 },
});
