import { useNavigation } from "@react-navigation/native";
import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Header } from "../../components/common/Header";
import { SettingsRow, SettingsSection } from "../../components/settings/SettingsList";
import { useTheme } from "../../context/ThemeContext";
import { getString } from "../../strings/translations";

export const BackupSettingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Header
        title={getString("settings.sections.backup")}
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <SettingsSection>
          <SettingsRow
            icon="cloud-outline"
            label="Remote Backup"
            onPress={() => (navigation as any).navigate("RemoteBackup")}
          />
          <SettingsRow
            icon="archive-outline"
            label="Legacy Backup"
            onPress={() => (navigation as any).navigate("LegacyBackup")}
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

