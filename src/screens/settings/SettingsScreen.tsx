import { useNavigation } from "@react-navigation/native";
import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Header } from "../../components/common/Header";
import { SettingsRow, SettingsSection } from "../../components/settings/SettingsList";
import { useTheme } from "../../context/ThemeContext";
import { getString } from "../../strings/translations";

export const SettingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Header
        title={getString("settings.title")}
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <SettingsSection>
          <SettingsRow
            icon="settings-outline"
            label={getString("settings.sections.general")}
            onPress={() => (navigation as any).navigate("SettingsGeneral")}
          />
          <SettingsRow
            icon="color-palette-outline"
            label={getString("settings.sections.appearance")}
            onPress={() => (navigation as any).navigate("Appearance")}
          />
          <SettingsRow
            icon="book-outline"
            label={getString("settings.sections.reader")}
            onPress={() => (navigation as any).navigate("SettingsReader")}
          />
          <SettingsRow
            icon="analytics-outline"
            label={getString("settings.sections.tracking")}
            onPress={() => (navigation as any).navigate("SettingsTracking")}
          />
          <SettingsRow
            icon="cloud-outline"
            label={getString("settings.sections.backup")}
            onPress={() => (navigation as any).navigate("SettingsBackup")}
          />
          <SettingsRow
            icon="server-outline"
            label={getString("settings.sections.advanced")}
            onPress={() => (navigation as any).navigate("SettingsAdvanced")}
          />
          <SettingsRow
            icon="information-circle-outline"
            label={getString("settings.sections.about")}
            onPress={() => (navigation as any).navigate("SettingsAbout")}
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
