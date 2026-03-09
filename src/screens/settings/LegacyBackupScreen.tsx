// src/screens/settings/LegacyBackupScreen.tsx
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Header } from "../../components/common/Header";
import { useHistory } from "../../context/HistoryContext";
import { useLibrary } from "../../context/LibraryContext";
import { useTheme } from "../../context/ThemeContext";
import { DatabaseService, BackupPayload } from "../../services/database";

interface DataActionProps {
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  isDestructive?: boolean;
  isLoading?: boolean;
  disabled?: boolean;
}

const DataAction: React.FC<DataActionProps> = ({
  title,
  description,
  icon,
  onPress,
  isDestructive = false,
  isLoading = false,
  disabled = false,
}) => {
  const { theme } = useTheme();

  return (
    <TouchableOpacity
      style={[
        styles.actionCard,
        { backgroundColor: theme.colors.surface },
        isDestructive && { borderColor: theme.colors.error, borderWidth: 1 },
        (disabled || isLoading) && { opacity: 0.6 },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={disabled || isLoading}
    >
      <View
        style={[
          styles.iconContainer,
          {
            backgroundColor: isDestructive
              ? theme.colors.error + "20"
              : theme.colors.primary + "20",
          },
        ]}
      >
        {isLoading ? (
          <ActivityIndicator
            size="small"
            color={isDestructive ? theme.colors.error : theme.colors.primary}
          />
        ) : (
          <Ionicons
            name={icon}
            size={24}
            color={isDestructive ? theme.colors.error : theme.colors.primary}
          />
        )}
      </View>
      <View style={styles.actionContent}>
        <Text
          style={[
            styles.actionTitle,
            { color: isDestructive ? theme.colors.error : theme.colors.text },
          ]}
        >
          {title}
        </Text>
        <Text
          style={[styles.actionDescription, { color: theme.colors.textSecondary }]}
        >
          {description}
        </Text>
      </View>
      <Ionicons
        name="chevron-forward"
        size={20}
        color={theme.colors.textSecondary}
      />
    </TouchableOpacity>
  );
};

export const LegacyBackupScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const library = useLibrary();
  const history = useHistory();

  const [isLoading, setIsLoading] = useState(false);

  const handleExportBackup = async () => {
    setIsLoading(true);
    try {
      const payload = await DatabaseService.exportBackup();
      const json = JSON.stringify(payload, null, 2);

      const filename = `novelnest-backup-${new Date()
        .toISOString()
        .replace(/[:.]/g, "-")}.json`;

      let uri: string | null = null;

      if (Platform.OS === "android" && FileSystem.StorageAccessFramework) {
        const perm =
          await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (perm.granted) {
          const targetUri = await FileSystem.StorageAccessFramework.createFileAsync(
            perm.directoryUri,
            filename,
            "application/json",
          );
          await FileSystem.writeAsStringAsync(targetUri, json, {
            encoding: FileSystem.EncodingType.UTF8,
          });
          uri = targetUri;
        }
      }

      if (!uri) {
        const base = FileSystem.documentDirectory;
        if (!base) throw new Error("Missing document directory.");
        const path = `${base}${filename}`;
        await FileSystem.writeAsStringAsync(path, json, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        uri = path;
      }

      // On non-Android platforms, offer to share the file using the system share sheet.
      if (Platform.OS !== "android" && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/json",
          dialogTitle: "Share NovelNest backup",
        });
      } else {
        Alert.alert("Backup Exported", `Saved to:\n${uri}`);
      }
    } catch (e: any) {
      Alert.alert("Export Failed", e?.message || "Could not export backup.");
    } finally {
      setIsLoading(false);
    }
  };

  const importBackupFromUri = async (uri: string, mode: "replace" | "merge") => {
    setIsLoading(true);
    try {
      const json = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const parsed = JSON.parse(json) as BackupPayload;

      const novelCount = parsed.library?.novels?.length ?? 0;
      const categoryCount = parsed.library?.categories?.length ?? 0;
      const historyCount = parsed.history?.length ?? 0;
      const hasSettings = "settings" in parsed && !!(parsed as any).settings;
      const version = parsed.version;

      const summaryLines = [
        `Version: ${version}`,
        `Novels: ${novelCount}`,
        `Categories: ${categoryCount}`,
        `History entries: ${historyCount}`,
        hasSettings ? "Includes app settings" : "No app settings included",
      ].join("\n");

      await new Promise<void>((resolve, reject) => {
        Alert.alert(
          "Confirm Import",
          `You are about to ${mode === "replace" ? "replace" : "merge"} your library with this backup:\n\n${summaryLines}\n\nProceed?`,
          [
            { text: "Cancel", style: "cancel", onPress: () => reject(new Error("Import cancelled")) },
            {
              text: mode === "replace" ? "Replace" : "Merge",
              style: mode === "replace" ? "destructive" : "default",
              onPress: () => resolve(),
            },
          ],
        );
      });

      await DatabaseService.importBackup(parsed, { mode });
      await Promise.all([library.reloadFromDatabase(), history.reloadFromDatabase()]);

      const hasSettingsInBackup = !!(parsed as any).settings;

      const settingsNote = hasSettingsInBackup
        ? "\n\nNote: Settings from this backup have also been applied and will fully take effect after restarting the app."
        : "";

      Alert.alert(
        "Import Complete",
        (mode === "replace"
          ? "Your library database was replaced with the backup."
          : "Backup was merged into your library database.") + settingsNote,
      );
    } catch (e: any) {
      Alert.alert("Import Failed", e?.message || "Could not import backup.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportBackup = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/json", "text/json", "text/plain", "*/*"],
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      const uri = result.assets[0].uri;

      Alert.alert(
        "Import Backup",
        "How do you want to import this backup?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Merge", onPress: () => void importBackupFromUri(uri, "merge") },
          {
            text: "Replace",
            style: "destructive",
            onPress: () => void importBackupFromUri(uri, "replace"),
          },
        ],
      );
    } catch (e: any) {
      Alert.alert("Import Failed", e?.message || "Could not open file picker.");
    }
  };

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Header title="Legacy Backup" onBackPress={() => navigation.goBack()} />
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
            Backups
          </Text>
          <DataAction
            title="Export backup"
            description="Save your library, history, and settings to a JSON file"
            icon="download-outline"
            onPress={() => void handleExportBackup()}
            isLoading={isLoading}
          />
          <DataAction
            title="Import backup"
            description="Restore a previously exported JSON backup"
            icon="cloud-upload-outline"
            onPress={() => void handleImportBackup()}
            isLoading={isLoading}
          />
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: theme.colors.textSecondary }]}>
            Backups are stored as JSON files.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 32 },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
    marginLeft: 4,
  },
  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  actionContent: { flex: 1, marginRight: 8 },
  actionTitle: { fontSize: 16, fontWeight: "600", marginBottom: 4 },
  actionDescription: { fontSize: 12, lineHeight: 16 },
  footer: { alignItems: "center", marginTop: 12, paddingTop: 12 },
  footerText: { fontSize: 11, opacity: 0.7, textAlign: "center" },
});
