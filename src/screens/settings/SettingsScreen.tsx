// src/screens/settings/SettingsScreen.tsx
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import * as FileSystem from "expo-file-system/legacy";
import React, { useState } from "react";
import {
  Alert,
  Linking,
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
import { useSettings } from "../../context/SettingsContext";
import { useTheme } from "../../context/ThemeContext";
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

// ── Main screen ───────────────────────────────────────────────────────────────

export const SettingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const {
    settings,
    updateGeneralSettings,
    updateDisplaySettings,
    updateAutoDownloadSettings,
    updateUpdatesSettings,
    setDownloadLocation,
  } = useSettings();

  const [showStartScreenModal, setShowStartScreenModal] = useState(false);
  const [showUpdateFrequencyModal, setShowUpdateFrequencyModal] =
    useState(false);

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

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Header
        title="Settings"
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
        <Section title="General">
          <Row
            icon="home-outline"
            label="Start screen"
            subtitle={getStartScreenLabel(settings.general.startScreen)}
            onPress={() => setShowStartScreenModal(true)}
          />
          <Row
            icon="language-outline"
            label="Language"
            subtitle={
              settings.general.language === "en"
                ? "English"
                : settings.general.language
            }
            onPress={() => {
              /* show language picker */
            }}
          />
          <Row
            icon="folder-open-outline"
            label="Download location"
            subtitle={downloadLocationLabel}
            onPress={handleSelectDownloadLocation}
            isLast
          />
        </Section>

        {/* Display */}
        <Section title="Display">
          <Row
            icon={
              settings.display.theme === "dark"
                ? "moon-outline"
                : "sunny-outline"
            }
            label="Dark mode"
            isLast
            rightElement={
              <ImprovedSwitch
                value={settings.display.theme === "dark"}
                onValueChange={(v) =>
                  updateDisplaySettings("theme", v ? "dark" : "light")
                }
              />
            }
          />
        </Section>

        {/* Auto-download */}
        <Section title="Auto-download">
          <Row
            icon="cloud-download-outline"
            label="Download new chapters"
            isLast
            rightElement={
              <ImprovedSwitch
                value={settings.autoDownload.downloadNewChapters}
                onValueChange={(v) =>
                  updateAutoDownloadSettings("downloadNewChapters", v)
                }
              />
            }
          />
        </Section>

        {/* Library */}
        <Section title="Library">
          <Row
            icon="albums-outline"
            label="Categories"
            onPress={() => navigation.navigate("EditCategories")}
            isLast
          />
        </Section>

        {/* Updates */}
        <Section title="Updates">
          <Row
            icon="alarm-outline"
            label="Update frequency"
            subtitle={getUpdateFrequencyLabel(settings.updates.frequency)}
            onPress={() => setShowUpdateFrequencyModal(true)}
          />
          <Row
            icon="git-branch-outline"
            label="Only update ongoing"
            isLast
            rightElement={
              <ImprovedSwitch
                value={settings.updates.onlyUpdateOngoing}
                onValueChange={(v) =>
                  updateUpdatesSettings("onlyUpdateOngoing", v)
                }
              />
            }
          />
        </Section>

        {/* Reader */}
        <Section title="Reader">
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
        <Section title="Tracking">
          <Row
            icon="analytics-outline"
            label="Services"
            onPress={() => navigation.navigate("TrackingServices")}
            isLast
          />
        </Section>

        {/* Backup */}
        <Section title="Backup">
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
        <Section title="Advanced">
          <Row
            icon="server-outline"
            label="Data Management"
            subtitle="Storage, cache, and user agent"
            onPress={() => navigation.navigate("DataManagement")}
            isLast
          />
        </Section>

        {/* About */}
        <Section title="About">
          <Row
            icon="information-circle-outline"
            label="Version"
            subtitle="1.0.0"
            isLast
          />
        </Section>

        <View style={styles.bottomPad} />
      </ScrollView>

      <SelectionModal
        visible={showStartScreenModal}
        title="Select Start Screen"
        options={START_SCREENS}
        selectedValue={settings.general.startScreen}
        onSelect={(value) =>
          updateGeneralSettings("startScreen", value as StartScreen)
        }
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
