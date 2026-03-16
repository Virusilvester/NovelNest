import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { Header } from "../../components/common/Header";
import { SelectionModal } from "../../components/common/SelectionModal";
import { useSettings } from "../../context/SettingsContext";
import { useTheme } from "../../context/ThemeContext";
import { getString } from "../../strings/translations";

const LANGUAGE_OPTIONS: { value: string; label: string }[] = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
];

export const AppearanceScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { settings, updateDisplaySettings, updateGeneralSettings } = useSettings();

  const [isLanguageModalVisible, setIsLanguageModalVisible] = useState(false);

  const themeValue = settings.display.theme;
  const themeLabel =
    themeValue === "system"
      ? getString("settings.appearance.themeSystem")
      : themeValue === "dark"
        ? getString("settings.appearance.themeDark")
        : getString("settings.appearance.themeLight");

  const languageLabel = useMemo(() => {
    const code = String(settings.general.language || "en");
    const found = LANGUAGE_OPTIONS.find((o) => o.value === code);
    return found?.label || code;
  }, [settings.general.language]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Header title={getString("settings.appearance.title")} onBackPress={() => (navigation as any).goBack()} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
          {getString("settings.sections.appearance")}
        </Text>

        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={styles.row}>
            <View style={[styles.iconWrap, { backgroundColor: theme.colors.primary + "18" }]}>
              <Ionicons name="color-palette-outline" size={18} color={theme.colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: theme.colors.text }]}>{getString("settings.appearance.themeMode")}</Text>
              <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>{themeLabel}</Text>
            </View>
          </View>

          <View style={styles.segmented}>
            {([
              { value: "system", label: getString("settings.appearance.themeSystem") },
              { value: "light", label: getString("settings.appearance.themeLight") },
              { value: "dark", label: getString("settings.appearance.themeDark") },
            ] as const).map((opt) => {
              const active = settings.display.theme === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => updateDisplaySettings("theme", opt.value)}
                  style={[
                    styles.segment,
                    { borderColor: theme.colors.border },
                    active && { backgroundColor: theme.colors.primary + "20", borderColor: theme.colors.primary },
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      { color: active ? theme.colors.primary : theme.colors.textSecondary },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={[styles.divider, { backgroundColor: theme.colors.divider }]} />

          <TouchableOpacity style={styles.row} onPress={() => setIsLanguageModalVisible(true)} activeOpacity={0.7}>
            <View style={[styles.iconWrap, { backgroundColor: theme.colors.primary + "18" }]}>
              <Ionicons name="language-outline" size={18} color={theme.colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: theme.colors.text }]}>{getString("settings.appearance.appLanguage")}</Text>
              <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>{languageLabel}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      <SelectionModal
        visible={isLanguageModalVisible}
        title={getString("settings.appearance.appLanguage")}
        options={LANGUAGE_OPTIONS}
        selectedValue={String(settings.general.language || "en")}
        onSelect={(value) => updateGeneralSettings("language", value)}
        onClose={() => setIsLanguageModalVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32, gap: 12 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginLeft: 4,
  },
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  label: { fontSize: 15, fontWeight: "600" },
  subtitle: { fontSize: 12, marginTop: 2 },
  divider: { height: StyleSheet.hairlineWidth },
  segmented: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  segment: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentText: { fontSize: 13, fontWeight: "700" },
});

