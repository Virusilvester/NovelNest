import { useNavigation } from "@react-navigation/native";
import React, { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Header } from "../../components/common/Header";
import { SettingsRow, SettingsSection } from "../../components/settings/SettingsList";
import { useTheme } from "../../context/ThemeContext";
import { useUpdates } from "../../context/UpdatesContext";
import { getString } from "../../strings/translations";

// Bundled app config (works on native + web)
const appConfig = require("../../../app.json");

export const AboutSettingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const {
    lastCheckedAt,
    isChecking: isUpdateChecking,
    progress: updatesProgress,
    checkForUpdates,
  } = useUpdates();

  const appVersion = String(appConfig?.expo?.version || "Unknown");

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

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Header
        title={getString("settings.sections.about")}
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <SettingsSection>
          <SettingsRow
            icon="refresh-outline"
            label="Check for updates"
            subtitle={updatesStatusSubtitle}
            onPress={isUpdateChecking ? undefined : handleCheckUpdatesNow}
            rightElement={
              isUpdateChecking ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : undefined
            }
          />
          <SettingsRow
            icon="information-circle-outline"
            label="Version"
            subtitle={appVersion}
            isLast
          />
        </SettingsSection>

        <View style={styles.bottomPad} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 32 },
  bottomPad: { height: 8 },
});

