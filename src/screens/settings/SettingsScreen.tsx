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
    View
} from "react-native";
import { Header } from "../../components/common/Header";
import { ImprovedSwitch } from "../../components/common/ImprovedSwitch";
import { SelectionModal } from "../../components/common/SelectionModal";
import { START_SCREENS, UPDATE_FREQUENCIES } from "../../constants";
import { useSettings } from "../../context/SettingsContext";
import { useTheme } from "../../context/ThemeContext";
import { StartScreen } from "../../types";

interface SettingsSectionProps {
  title: string;
  children: React.ReactNode;
}

const SettingsSection: React.FC<SettingsSectionProps> = ({
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
          styles.sectionContent,
          { backgroundColor: theme.colors.surface },
        ]}
      >
        {children}
      </View>
    </View>
  );
};

interface SettingsItemProps {
  title: string;
  subtitle?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  showArrow?: boolean;
  isDestructive?: boolean;
}

const SettingsItem: React.FC<SettingsItemProps> = ({
  title,
  subtitle,
  onPress,
  rightElement,
  showArrow = true,
  isDestructive = false,
}) => {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      style={[styles.item, { borderBottomColor: theme.colors.divider }]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.itemContent}>
        <Text
          style={[
            styles.itemTitle,
            { color: isDestructive ? theme.colors.error : theme.colors.text },
          ]}
        >
          {title}
        </Text>
        {subtitle && (
          <Text
            style={[styles.itemSubtitle, { color: theme.colors.textSecondary }]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        )}
      </View>
      {rightElement ||
        (showArrow && onPress && (
          <Ionicons
            name="chevron-forward"
            size={20}
            color={
              isDestructive ? theme.colors.error : theme.colors.textSecondary
            }
          />
        ))}
    </TouchableOpacity>
  );
};

export const SettingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const {
    settings,
    updateGeneralSettings,
    updateDisplaySettings,
    updateAutoDownloadSettings,
    updateUpdatesSettings,
    //resetSettings,
    setDownloadLocation,
  } = useSettings();

  const [showStartScreenModal, setShowStartScreenModal] = useState(false);
  const [showUpdateFrequencyModal, setShowUpdateFrequencyModal] =
    useState(false);

  const handleHelpPress = () => {
    Linking.openURL("https://github.com/your-repo/wiki");
  };

  const handleSelectDownloadLocation = async () => {
    try {
      if (Platform.OS === "android" && FileSystem.StorageAccessFramework) {
        const perm =
          await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (perm.granted) {
          await setDownloadLocation(perm.directoryUri);
        }
        return;
      }

      Alert.alert(
        "Not supported",
        "Custom download location is only supported on Android. Downloads will be stored internally.",
      );
    } catch (err) {
      console.error("Error selecting download location:", err);
    }
  };

  // const handleClearSettings = () => {
  //   Alert.alert(
  //     "Clear Settings",
  //     "Are you sure you want to reset all settings to default? This action cannot be undone.",
  //     [
  //       { text: "Cancel", style: "cancel" },
  //       {
  //         text: "Reset",
  //         style: "destructive",
  //         onPress: async () => {
  //           await resetSettings();
  //           Alert.alert("Success", "Settings have been reset to default.");
  //         },
  //       },
  //     ],
  //   );
  // };

  const getStartScreenLabel = (value: StartScreen) => {
    return START_SCREENS.find((s) => s.value === value)?.label || "Library";
  };

  const getUpdateFrequencyLabel = (value: string) => {
    return UPDATE_FREQUENCIES.find((f) => f.value === value)?.label || "Daily";
  };

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Header
        title="Settings"
        onBackPress={() => navigation.goBack()}
        rightButtons={
          <TouchableOpacity onPress={handleHelpPress} style={styles.iconButton}>
            <Ionicons
              name="help-circle-outline"
              size={24}
              color={theme.colors.text}
            />
          </TouchableOpacity>
        }
      />

      <ScrollView style={styles.content}>
        {/* General Section */}
        <SettingsSection title="General">
          <SettingsItem
            title="Start screen"
            subtitle={getStartScreenLabel(settings.general.startScreen)}
            onPress={() => setShowStartScreenModal(true)}
          />
          <SettingsItem
            title="Language"
            subtitle={
              settings.general.language === "en"
                ? "English"
                : settings.general.language
            }
            onPress={() => {
              /* Show language selection */
            }}
          />
          <SettingsItem
            title="Download location"
            subtitle={
              !settings.general.downloadLocation
                ? "Internal (default)"
                : settings.general.downloadLocation.startsWith("content://")
                  ? "Custom folder (Android)"
                  : settings.general.downloadLocation
            }
            onPress={handleSelectDownloadLocation}
          />
        </SettingsSection>

        {/* Display Section */}
        <SettingsSection title="Display">
          <SettingsItem
            title="App Theme"
            subtitle={settings.display.theme === "dark" ? "Dark" : "Light"}
            rightElement={
              <ImprovedSwitch
                value={settings.display.theme === "dark"}
                onValueChange={(v) =>
                  updateDisplaySettings("theme", v ? "dark" : "light")
                }
              />
            }
            showArrow={false}
          />
        </SettingsSection>

        {/* Auto-download Section */}
        <SettingsSection title="Auto-download">
          <SettingsItem
            title="Download new chapters"
            rightElement={
              <ImprovedSwitch
                value={settings.autoDownload.downloadNewChapters}
                onValueChange={(v) =>
                  updateAutoDownloadSettings("downloadNewChapters", v)
                }
              />
            }
            showArrow={false}
          />
        </SettingsSection>

        {/* Library Section */}
        <SettingsSection title="Library">
          <SettingsItem
            title="Categories"
            onPress={() => navigation.navigate("EditCategories")}
          />
        </SettingsSection>

        {/* Updates Section */}
        <SettingsSection title="Updates">
          <SettingsItem
            title="Library update frequency"
            subtitle={getUpdateFrequencyLabel(settings.updates.frequency)}
            onPress={() => setShowUpdateFrequencyModal(true)}
          />
          <SettingsItem
            title="Only update ongoing"
            rightElement={
              <ImprovedSwitch
                value={settings.updates.onlyUpdateOngoing}
                onValueChange={(v) =>
                  updateUpdatesSettings("onlyUpdateOngoing", v)
                }
              />
            }
            showArrow={false}
          />
        </SettingsSection>

        {/* Reader Section */}
        <SettingsSection title="Reader">
          <SettingsItem
            title="General"
            onPress={() => navigation.navigate("ReaderSettings")}
          />
          <SettingsItem
            title="Reader theme"
            onPress={() => navigation.navigate("ReaderTheme")}
          />
          <SettingsItem
            title="Text to Speech"
            onPress={() => navigation.navigate("TTSSettings")}
          />
        </SettingsSection>

        {/* Tracking Section */}
        <SettingsSection title="Tracking">
          <SettingsItem
            title="Services"
            onPress={() => navigation.navigate("TrackingServices")}
          />
        </SettingsSection>

        {/* Backup Section */}
        <SettingsSection title="Backup">
          <SettingsItem
            title="Remote Backup"
            onPress={() => navigation.navigate("RemoteBackup")}
          />
          <SettingsItem
            title="Legacy Backup"
            onPress={() => navigation.navigate("LegacyBackup")}
          />
        </SettingsSection>

        {/* Advanced Section */}
        <SettingsSection title="Advanced">
          <SettingsItem
            title="Data Management"
            subtitle="Storage, cache, and user agent"
            onPress={() => navigation.navigate("DataManagement")}
          />
          {/* <SettingsItem
            title="Reset settings"
            subtitle="Restore defaults"
            onPress={handleClearSettings}
            isDestructive
          /> */}
        </SettingsSection>

        {/* About Section */}
        <SettingsSection title="About">
          <SettingsItem title="Version" subtitle="1.0.0" showArrow={false} />
        </SettingsSection>
      </ScrollView>

      {/* Selection Modals */}
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
  container: {
    flex: 1,
  },
  iconButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    marginHorizontal: 16,
    marginBottom: 8,
  },
  sectionContent: {
    marginHorizontal: 16,
    borderRadius: 8,
    overflow: "hidden",
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
  },
  itemContent: {
    flex: 1,
    marginRight: 8,
  },
  itemTitle: {
    fontSize: 16,
  },
  itemSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
});
