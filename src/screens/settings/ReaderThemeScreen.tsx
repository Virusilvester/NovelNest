// src/screens/settings/ReaderThemeScreen.tsx
import { useNavigation } from "@react-navigation/native";
import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Header } from "../../components/common/Header";
import { useSettings } from "../../context/SettingsContext";
import { useTheme } from "../../context/ThemeContext";

export const ReaderThemeScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { settings, updateReaderSettings } = useSettings();

  const presets = ["Default", "Dark", "Sepia", "Green"];

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Header title="Reader Theme" onBackPress={() => navigation.goBack()} />

      <ScrollView style={styles.content}>
        <View
          style={[styles.section, { backgroundColor: theme.colors.surface }]}
        >
          <Text
            style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}
          >
            Preset
          </Text>
          <View style={styles.presetsContainer}>
            {presets.map((preset) => (
              <TouchableOpacity
                key={preset}
                style={[
                  styles.presetButton,
                  {
                    backgroundColor:
                      settings.reader.theme.preset === preset
                        ? theme.colors.primary
                        : theme.colors.border,
                  },
                ]}
                onPress={() => updateReaderSettings("theme", "preset", preset)}
              >
                <Text
                  style={[
                    styles.presetText,
                    {
                      color:
                        settings.reader.theme.preset === preset
                          ? "#FFF"
                          : theme.colors.text,
                    },
                  ]}
                >
                  {preset}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View
          style={[styles.section, { backgroundColor: theme.colors.surface }]}
        >
          <Text
            style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}
          >
            Colors
          </Text>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.colors.text }]}>
              Background
            </Text>
            <TextInput
              style={[
                styles.input,
                { color: theme.colors.text, borderColor: theme.colors.border },
              ]}
              value={settings.reader.theme.backgroundColor}
              onChangeText={(v) =>
                updateReaderSettings("theme", "backgroundColor", v)
              }
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.colors.text }]}>
              Text
            </Text>
            <TextInput
              style={[
                styles.input,
                { color: theme.colors.text, borderColor: theme.colors.border },
              ]}
              value={settings.reader.theme.textColor}
              onChangeText={(v) =>
                updateReaderSettings("theme", "textColor", v)
              }
            />
          </View>
        </View>

        <View
          style={[styles.section, { backgroundColor: theme.colors.surface }]}
        >
          <Text
            style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}
          >
            Text Settings
          </Text>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.colors.text }]}>
              Text Size: {settings.reader.theme.textSize}px
            </Text>
            {/* Add slider here */}
          </View>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.colors.text }]}>
              Line Height: {settings.reader.theme.lineHeight}
            </Text>
            {/* Add slider here */}
          </View>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.colors.text }]}>
              Padding: {settings.reader.theme.padding}px
            </Text>
            {/* Add slider here */}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    borderRadius: 8,
    marginBottom: 16,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 12,
  },
  presetsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  presetButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  presetText: {
    fontSize: 14,
    fontWeight: "bold",
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
  },
  input: {
    height: 40,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 12,
    fontSize: 16,
  },
});
