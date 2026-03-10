// src/screens/settings/ReaderThemeScreen.tsx
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import {
  Keyboard,
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

// ─── Colour swatch ────────────────────────────────────────────────────────────
const SWATCHES_BG = [
  "#FFFFFF", "#F5EDD6", "#E6EFE6", "#E8E8E8",
  "#181820", "#000000", "#1A1A2E", "#0D0D0D",
  "#FFF8F0", "#F0F4FF", "#FFF0F5", "#F0FFF4",
];
const SWATCHES_TEXT = [
  "#000000", "#1A1A1A", "#2D2D2D", "#3D3D3D",
  "#FFFFFF", "#DEDEDE", "#C8C8C8", "#A0A0A0",
  "#3D2B1F", "#1A3021", "#1A1A4A", "#1A3A1A",
];

// ─── Inline colour picker row ─────────────────────────────────────────────────
interface ColourRowProps {
  label: string;
  value: string;
  swatches: string[];
  onChange: (hex: string) => void;
}

const ColourRow: React.FC<ColourRowProps> = ({ label, value, swatches, onChange }) => {
  const { theme } = useTheme();
  const [hex, setHex] = useState(value);
  const [focused, setFocused] = useState(false);

  // Sync external value → local state when prop changes
  React.useEffect(() => { setHex(value); }, [value]);

  const commit = useCallback((raw: string) => {
    const v = raw.trim();
    // Accept #RGB, #RRGGBB, #RRGGBBAA
    if (/^#[0-9a-fA-F]{3,8}$/.test(v)) onChange(v);
  }, [onChange]);

  return (
    <View style={cr.wrap}>
      <View style={cr.labelRow}>
        {/* Live colour preview dot */}
        <View style={[cr.dot, { backgroundColor: value, borderColor: theme.colors.border }]} />
        <Text style={[cr.label, { color: theme.colors.text }]}>{label}</Text>
        {/* Hex input */}
        <View style={[cr.hexWrap, { backgroundColor: theme.colors.background, borderColor: focused ? theme.colors.primary : theme.colors.border }]}>
          <TextInput
            value={hex}
            onChangeText={setHex}
            onFocus={() => setFocused(true)}
            onBlur={() => { setFocused(false); commit(hex); }}
            onSubmitEditing={() => { commit(hex); Keyboard.dismiss(); }}
            placeholder="#000000"
            placeholderTextColor={theme.colors.textSecondary}
            style={[cr.hexInput, { color: theme.colors.text }]}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={9}
            returnKeyType="done"
          />
        </View>
      </View>
      {/* Swatch grid */}
      <View style={cr.swatchGrid}>
        {swatches.map((sw) => (
          <TouchableOpacity
            key={sw}
            style={[
              cr.swatch,
              { backgroundColor: sw, borderColor: sw === value ? theme.colors.primary : (sw === "#FFFFFF" || sw === "#F5EDD6" || sw === "#E6EFE6" || sw === "#E8E8E8" || sw === "#F0F4FF" || sw === "#FFF8F0" || sw === "#FFF0F5" || sw === "#F0FFF4" ? "#CCCCCC" : "transparent") },
              sw === value && { borderWidth: 2.5 },
            ]}
            onPress={() => { onChange(sw); setHex(sw); }}
          >
            {sw === value && (
              <Ionicons name="checkmark" size={12} color={sw === "#FFFFFF" || sw === "#F5EDD6" ? "#333" : "#FFF"} />
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const cr = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  dot: { width: 24, height: 24, borderRadius: 12, borderWidth: 1 },
  label: { flex: 1, fontSize: 15, fontWeight: "600" },
  hexWrap: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, height: 36, justifyContent: "center" },
  hexInput: { fontSize: 13, fontWeight: "600", minWidth: 80 },
  swatchGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingLeft: 34 },
  swatch: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, justifyContent: "center", alignItems: "center" },
});

// ─── Main screen ──────────────────────────────────────────────────────────────
export const ReaderThemeScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { settings, updateReaderSettings, updateReaderSettingsBatch } = useSettings();
  const t = settings.reader.theme;

  // Preset definitions — bg, text, label
  const PRESETS = [
    { key: "Default", bg: "#FFFFFF", fg: "#1A1A1A", label: "Day",    dark: false },
    { key: "Dark",    bg: "#181820", fg: "#DEDEDE", label: "Night",  dark: true  },
    { key: "Sepia",   bg: "#F5EDD6", fg: "#3D2B1F", label: "Sepia",  dark: false },
    { key: "Amoled",  bg: "#000000", fg: "#C8C8C8", label: "AMOLED", dark: true  },
    { key: "Forest",  bg: "#E6EFE6", fg: "#1A3021", label: "Forest", dark: false },
    { key: "Slate",   bg: "#1E2030", fg: "#C0C8D8", label: "Slate",  dark: true  },
  ] as const;

  const applyPreset = useCallback(async (key: string, bg: string, fg: string) => {
    await updateReaderSettingsBatch([
      { section: "theme", key: "preset",          value: key },
      { section: "theme", key: "backgroundColor", value: bg  },
      { section: "theme", key: "textColor",       value: fg  },
    ]);
  }, [updateReaderSettingsBatch]);

  return (
    <View style={[S.container, { backgroundColor: theme.colors.background }]}>
      <Header title="Reader Theme" onBackPress={() => navigation.goBack()} />

      <ScrollView style={S.scroll} contentContainerStyle={S.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Live preview */}
        <View style={S.previewSection}>
          <View style={[S.preview, { backgroundColor: t.backgroundColor, borderColor: theme.colors.border }]}>
            <Text style={[S.previewBig, { color: t.textColor, fontFamily: t.fontStyle === "Serif" ? "serif" : t.fontStyle === "Mono" ? "monospace" : undefined }]}>
              Aa — {t.textSize}px
            </Text>
            <Text
              style={[
                S.previewBody,
                {
                  color: t.textColor,
                  fontSize: t.textSize,
                  lineHeight: t.textSize * t.lineHeight,
                  textAlign: t.textAlign,
                  fontFamily: t.fontStyle === "Serif" ? "serif" : t.fontStyle === "Mono" ? "monospace" : undefined,
                },
              ]}
              numberOfLines={3}
            >
              The sun had long since set behind the mountains, casting long violet shadows across the silent valley below.
            </Text>
          </View>
        </View>

        {/* ── Presets ── */}
        <Text style={[S.sectionLabel, { color: theme.colors.textSecondary }]}>Presets</Text>
        <View style={[S.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={S.presetGrid}>
            {PRESETS.map((p) => {
              const active = t.preset === p.key || (t.backgroundColor === p.bg && t.textColor === p.fg);
              const lightBg = !p.dark;
              return (
                <TouchableOpacity
                  key={p.key}
                  style={[
                    S.presetCard,
                    { backgroundColor: p.bg, borderColor: active ? theme.colors.primary : lightBg ? "#CCCCCC" : p.bg },
                    active && { borderWidth: 2.5 },
                  ]}
                  onPress={() => void applyPreset(p.key, p.bg, p.fg)}
                >
                  <Text style={[S.presetCardLabel, { color: p.fg }]}>{p.label}</Text>
                  <Text style={[S.presetCardSample, { color: p.fg }]}>Aa</Text>
                  {active && (
                    <View style={S.presetCheck}>
                      <Ionicons name="checkmark-circle" size={18} color={theme.colors.primary} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Colours ── */}
        <Text style={[S.sectionLabel, { color: theme.colors.textSecondary }]}>Custom Colours</Text>
        <View style={[S.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <ColourRow
            label="Background"
            value={t.backgroundColor}
            swatches={SWATCHES_BG}
            onChange={(v) => void updateReaderSettings("theme", "backgroundColor", v)}
          />
          <View style={[S.divider, { backgroundColor: theme.colors.divider }]} />
          <ColourRow
            label="Text"
            value={t.textColor}
            swatches={SWATCHES_TEXT}
            onChange={(v) => void updateReaderSettings("theme", "textColor", v)}
          />
        </View>

      </ScrollView>
    </View>
  );
};

const S = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },

  previewSection: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  preview: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 10 },
  previewBig: { fontSize: 22, fontWeight: "800" },
  previewBody: { opacity: 0.9 },

  sectionLabel: {
    fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.8,
    marginTop: 22, marginBottom: 8, marginHorizontal: 20,
  },
  card: {
    marginHorizontal: 16, borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth, overflow: "hidden",
  },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },

  presetGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, padding: 14 },
  presetCard: {
    width: "29%",
    minWidth: 90,
    flex: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 12,
    alignItems: "flex-start",
    gap: 4,
  },
  presetCardLabel: { fontSize: 12, fontWeight: "700" },
  presetCardSample: { fontSize: 20, fontWeight: "800" },
  presetCheck: { position: "absolute", top: 6, right: 6 },
});