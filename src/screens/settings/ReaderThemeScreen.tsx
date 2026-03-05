// src/screens/settings/ReaderThemeScreen.tsx
import { useNavigation } from "@react-navigation/native";
import React, { useCallback } from "react";
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

  const applyPreset = useCallback(
    async (preset: string) => {
      let backgroundColor = settings.reader.theme.backgroundColor;
      let textColor = settings.reader.theme.textColor;

      switch (preset.toLowerCase()) {
        case "dark":
          backgroundColor = "#000000";
          textColor = "#FFFFFF";
          break;
        case "sepia":
          backgroundColor = "#F4E6C4";
          textColor = "#4A3B2A";
          break;
        case "green":
          backgroundColor = "#E6F4EA";
          textColor = "#143D1F";
          break;
        default:
          backgroundColor = "#FFFFFF";
          textColor = "#000000";
          break;
      }

      await updateReaderSettings("theme", "preset", preset);
      await updateReaderSettings("theme", "backgroundColor", backgroundColor);
      await updateReaderSettings("theme", "textColor", textColor);
    },
    [
      settings.reader.theme.backgroundColor,
      settings.reader.theme.textColor,
      updateReaderSettings,
    ],
  );

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

          {/* Live preview of current reader colors */}
          <View
            style={[
              styles.previewCard,
              {
                backgroundColor: settings.reader.theme.backgroundColor,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.previewTitle,
                { color: settings.reader.theme.textColor },
              ]}
            >
              Aa
            </Text>
            <Text
              style={[
                styles.previewBody,
                { color: settings.reader.theme.textColor },
              ]}
              numberOfLines={2}
            >
              Sample reader text preview using your current theme.
            </Text>
          </View>

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
                onPress={() => applyPreset(preset)}
              >
                <Text
                  style={[
                    styles.presetText,
                    {
                      color:
                        settings.reader.theme.preset === preset
                          ? theme.colors.onPrimary
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
            <View style={styles.rowControls}>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => {
                  const current = settings.reader.theme.textSize;
                  const next = Math.max(10, current - 1);
                  void updateReaderSettings("theme", "textSize", next);
                }}
              >
                <Text
                  style={[
                    styles.iconLabel,
                    { color: theme.colors.primary },
                  ]}
                >
                  -
                </Text>
              </TouchableOpacity>
              <Text
                style={[
                  styles.valueLabel,
                  { color: theme.colors.textSecondary },
                ]}
              >
                {settings.reader.theme.textSize}
              </Text>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => {
                  const current = settings.reader.theme.textSize;
                  const next = Math.min(40, current + 1);
                  void updateReaderSettings("theme", "textSize", next);
                }}
              >
                <Text
                  style={[
                    styles.iconLabel,
                    { color: theme.colors.primary },
                  ]}
                >
                  +
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.colors.text }]}>
              Line Height: {settings.reader.theme.lineHeight}
            </Text>
            <View style={styles.rowControls}>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => {
                  const current = settings.reader.theme.lineHeight;
                  const next =
                    Math.round(Math.max(1, current - 0.1) * 10) / 10;
                  void updateReaderSettings("theme", "lineHeight", next);
                }}
              >
                <Text
                  style={[
                    styles.iconLabel,
                    { color: theme.colors.primary },
                  ]}
                >
                  -
                </Text>
              </TouchableOpacity>
              <Text
                style={[
                  styles.valueLabel,
                  { color: theme.colors.textSecondary },
                ]}
              >
                {settings.reader.theme.lineHeight.toFixed(1)}
              </Text>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => {
                  const current = settings.reader.theme.lineHeight;
                  const next =
                    Math.round(Math.min(3, current + 0.1) * 10) / 10;
                  void updateReaderSettings("theme", "lineHeight", next);
                }}
              >
                <Text
                  style={[
                    styles.iconLabel,
                    { color: theme.colors.primary },
                  ]}
                >
                  +
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.colors.text }]}>
              Padding: {settings.reader.theme.padding}px
            </Text>
            <View style={styles.rowControls}>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => {
                  const current = settings.reader.theme.padding;
                  const next = Math.max(0, current - 2);
                  void updateReaderSettings("theme", "padding", next);
                }}
              >
                <Text
                  style={[
                    styles.iconLabel,
                    { color: theme.colors.primary },
                  ]}
                >
                  -
                </Text>
              </TouchableOpacity>
              <Text
                style={[
                  styles.valueLabel,
                  { color: theme.colors.textSecondary },
                ]}
              >
                {settings.reader.theme.padding}
              </Text>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => {
                  const current = settings.reader.theme.padding;
                  const next = Math.min(64, current + 2);
                  void updateReaderSettings("theme", "padding", next);
                }}
              >
                <Text
                  style={[
                    styles.iconLabel,
                    { color: theme.colors.primary },
                  ]}
                >
                  +
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View
          style={[styles.section, { backgroundColor: theme.colors.surface }]}
        >
          <Text
            style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}
          >
            Alignment & Font
          </Text>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.colors.text }]}>
              Text alignment
            </Text>
            <View style={styles.alignRow}>
              {(["left", "center", "justify"] as const).map((align) => (
                <TouchableOpacity
                  key={align}
                  style={[
                    styles.alignBtn,
                    {
                      borderColor: theme.colors.border,
                      backgroundColor:
                        settings.reader.theme.textAlign === align
                          ? theme.colors.primary
                          : "transparent",
                    },
                  ]}
                  onPress={() =>
                    updateReaderSettings("theme", "textAlign", align)
                  }
                >
                  <Text
                    style={[
                      styles.alignText,
                      {
                        color:
                          settings.reader.theme.textAlign === align
                            ? theme.colors.onPrimary
                            : theme.colors.text,
                      },
                    ]}
                  >
                    {align.charAt(0).toUpperCase() + align.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.colors.text }]}>
              Font style
            </Text>
            <View style={styles.alignRow}>
              {["System", "Serif", "Sans", "Mono"].map((font) => (
                <TouchableOpacity
                  key={font}
                  style={[
                    styles.alignBtn,
                    {
                      borderColor: theme.colors.border,
                      backgroundColor:
                        settings.reader.theme.fontStyle === font
                          ? theme.colors.primary
                          : "transparent",
                    },
                  ]}
                  onPress={() =>
                    updateReaderSettings("theme", "fontStyle", font)
                  }
                >
                  <Text
                    style={[
                      styles.alignText,
                      {
                        color:
                          settings.reader.theme.fontStyle === font
                            ? theme.colors.onPrimary
                            : theme.colors.text,
                      },
                    ]}
                  >
                    {font}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
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
  previewCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  previewTitle: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 4,
  },
  previewBody: {
    fontSize: 13,
  },
  rowControls: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 8,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#CCC",
  },
  iconLabel: {
    fontSize: 18,
    fontWeight: "700",
  },
  valueLabel: {
    minWidth: 48,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
  },
  alignRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  alignBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  alignText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
