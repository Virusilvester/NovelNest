import { useNavigation } from "@react-navigation/native";
import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Header } from "../../components/common/Header";
import { SettingsRow, SettingsSection } from "../../components/settings/SettingsList";
import { useTheme } from "../../context/ThemeContext";
import { getString } from "../../strings/translations";

export const ReaderSettingsMenuScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Header
        title={getString("settings.sections.reader")}
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
            label="General"
            onPress={() => (navigation as any).navigate("ReaderSettings")}
          />
          <SettingsRow
            icon="color-palette-outline"
            label="Reader theme"
            onPress={() => (navigation as any).navigate("ReaderTheme")}
          />
          <SettingsRow
            icon="mic-outline"
            label="Text to Speech"
            onPress={() => (navigation as any).navigate("TTSSettings")}
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

