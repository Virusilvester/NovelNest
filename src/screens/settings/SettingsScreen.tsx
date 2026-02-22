// src/screens/settings/SettingsScreen.tsx
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React from "react";
import {
  Linking,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Header } from "../../components/common/Header";
import { START_SCREENS, UPDATE_FREQUENCIES } from "../../constants";
import { useSettings } from "../../context/SettingsContext";
import { useTheme } from "../../context/ThemeContext";

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
}

const SettingsItem: React.FC<SettingsItemProps> = ({
  title,
  subtitle,
  onPress,
  rightElement,
  showArrow = true,
}) => {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      style={[styles.item, { borderBottomColor: theme.colors.divider }]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.itemContent}>
        <Text style={[styles.itemTitle, { color: theme.colors.text }]}>
          {title}
        </Text>
        {subtitle && (
          <Text
            style={[styles.itemSubtitle, { color: theme.colors.textSecondary }]}
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
            color={theme.colors.textSecondary}
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
  } = useSettings();

  const handleHelpPress = () => {
    Linking.openURL("https://github.com/your-repo/wiki");
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
        <SettingsSection title="General">
          <SettingsItem
            title="Start screen"
            subtitle={
              START_SCREENS.find(
                (s) => s.value === settings.general.startScreen,
              )?.label
            }
            onPress={() => {
              /* Show selection modal */
            }}
          />
        </SettingsSection>

        <SettingsSection title="Display">
          <SettingsItem
            title="Language"
            subtitle={settings.general.language}
            onPress={() => {
              /* Show language selection */
            }}
          />
          <SettingsItem
            title="App Theme"
            subtitle={settings.display.theme === "dark" ? "Dark" : "Light"}
            onPress={() =>
              updateDisplaySettings(
                "theme",
                settings.display.theme === "dark" ? "light" : "dark",
              )
            }
            rightElement={
              <Switch
                value={settings.display.theme === "dark"}
                onValueChange={(v) =>
                  updateDisplaySettings("theme", v ? "dark" : "light")
                }
              />
            }
            showArrow={false}
          />
        </SettingsSection>

        <SettingsSection title="Auto-download">
          <SettingsItem
            title="Download new chapters"
            rightElement={
              <Switch
                value={settings.autoDownload.downloadNewChapters}
                onValueChange={(v) =>
                  updateAutoDownloadSettings("downloadNewChapters", v)
                }
              />
            }
            showArrow={false}
          />
        </SettingsSection>

        <SettingsSection title="Library">
          <SettingsItem
            title="Categories"
            onPress={() => navigation.navigate("EditCategories")}
          />
        </SettingsSection>

        <SettingsSection title="Updates">
          <SettingsItem
            title="Library update frequency"
            subtitle={
              UPDATE_FREQUENCIES.find(
                (f) => f.value === settings.updates.frequency,
              )?.label
            }
            onPress={() => {
              /* Show frequency selection */
            }}
          />
          <SettingsItem
            title="Only update ongoing"
            rightElement={
              <Switch
                value={settings.updates.onlyUpdateOngoing}
                onValueChange={(v) =>
                  updateUpdatesSettings("onlyUpdateOngoing", v)
                }
              />
            }
            showArrow={false}
          />
        </SettingsSection>

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

        <SettingsSection title="Tracking">
          <SettingsItem
            title="Services"
            onPress={() => navigation.navigate("TrackingServices")}
          />
        </SettingsSection>

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

        <SettingsSection title="Advanced">
          <SettingsItem
            title="Data Management"
            onPress={() => navigation.navigate("DataManagement")}
          />
        </SettingsSection>

        <SettingsSection title="About">
          <SettingsItem title="Version" subtitle="1.0.0" showArrow={false} />
        </SettingsSection>
      </ScrollView>
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
  },
  itemTitle: {
    fontSize: 16,
  },
  itemSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
});
