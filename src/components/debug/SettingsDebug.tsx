// src/components/debug/SettingsDebug.tsx (temporary for testing)
import React from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { useSettings } from "../../context/SettingsContext";

export const SettingsDebug: React.FC = () => {
  const { settings } = useSettings();

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Current Settings (Persistent)</Text>
      <Text style={styles.section}>
        Display Mode: {settings.ui.libraryDisplayMode}
      </Text>
      <Text style={styles.section}>
        Show Download Badges: {settings.ui.showDownloadBadges ? "Yes" : "No"}
      </Text>
      <Text style={styles.section}>
        Show Unread Badges: {settings.ui.showUnreadBadges ? "Yes" : "No"}
      </Text>
      <Text style={styles.section}>
        Show Item Count: {settings.ui.showItemCount ? "Yes" : "No"}
      </Text>
      <Text style={styles.section}>Sort: {settings.ui.librarySortOption}</Text>
      <Text style={styles.section}>Theme: {settings.display.theme}</Text>
      <Text style={styles.section}>
        Start Screen: {settings.general.startScreen}
      </Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { padding: 20 },
  title: { fontSize: 18, fontWeight: "bold", marginBottom: 10 },
  section: { fontSize: 14, marginBottom: 8, fontFamily: "monospace" },
});
