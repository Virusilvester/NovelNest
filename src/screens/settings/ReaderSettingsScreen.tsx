// src/screens/settings/ReaderSettingsScreen.tsx
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Header } from "../../components/common/Header";
import { ImprovedSwitch } from "../../components/common/ImprovedSwitch";
import { useSettings } from "../../context/SettingsContext";
import { useTheme } from "../../context/ThemeContext";

// ─── Reusable sub-components ────────────────────────────────────────────────

const SectionHeader: React.FC<{ title: string }> = ({ title }) => {
  const { theme } = useTheme();
  return (
    <Text style={[sectionHeaderStyle.text, { color: theme.colors.textSecondary }]}>
      {title}
    </Text>
  );
};
const sectionHeaderStyle = StyleSheet.create({
  text: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
    marginTop: 24,
    marginHorizontal: 16,
  },
});

interface ToggleRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  isLast?: boolean;
}

const ToggleRow: React.FC<ToggleRowProps> = ({
  icon,
  label,
  description,
  value,
  onValueChange,
  isLast,
}) => {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.row,
        !isLast && { borderBottomWidth: 1, borderBottomColor: theme.colors.divider },
      ]}
    >
      <View style={[styles.rowIconWrap, { backgroundColor: theme.colors.primary + "1A" }]}>
        <Ionicons name={icon} size={18} color={theme.colors.primary} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: theme.colors.text }]}>{label}</Text>
        {description ? (
          <Text style={[styles.rowDesc, { color: theme.colors.textSecondary }]}>
            {description}
          </Text>
        ) : null}
      </View>
      <ImprovedSwitch value={value} onValueChange={onValueChange} />
    </View>
  );
};

interface StepperRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
  unit?: string;
  min: number;
  max: number;
  step: number;
  onDecrement: () => void;
  onIncrement: () => void;
  isLast?: boolean;
  formatValue?: (v: number) => string;
}

const StepperRow: React.FC<StepperRowProps> = ({
  icon,
  label,
  value,
  unit = "",
  min,
  max,
  onDecrement,
  onIncrement,
  isLast,
  formatValue,
}) => {
  const { theme } = useTheme();
  const display = formatValue ? formatValue(value) : `${value}${unit}`;
  return (
    <View
      style={[
        styles.row,
        !isLast && { borderBottomWidth: 1, borderBottomColor: theme.colors.divider },
      ]}
    >
      <View style={[styles.rowIconWrap, { backgroundColor: theme.colors.primary + "1A" }]}>
        <Ionicons name={icon} size={18} color={theme.colors.primary} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: theme.colors.text }]}>{label}</Text>
      </View>
      <View style={styles.stepperWrap}>
        <TouchableOpacity
          style={[
            styles.stepBtn,
            { borderColor: theme.colors.border },
            value <= min && styles.stepBtnDisabled,
          ]}
          onPress={onDecrement}
          disabled={value <= min}
        >
          <Text style={[styles.stepBtnText, { color: value <= min ? theme.colors.textSecondary : theme.colors.primary }]}>−</Text>
        </TouchableOpacity>
        <Text style={[styles.stepValue, { color: theme.colors.text }]}>{display}</Text>
        <TouchableOpacity
          style={[
            styles.stepBtn,
            { borderColor: theme.colors.border },
            value >= max && styles.stepBtnDisabled,
          ]}
          onPress={onIncrement}
          disabled={value >= max}
        >
          <Text style={[styles.stepBtnText, { color: value >= max ? theme.colors.textSecondary : theme.colors.primary }]}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

interface ChipGroupRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  options: { value: string; label: string }[];
  selected: string;
  onSelect: (v: string) => void;
  isLast?: boolean;
}

const ChipGroupRow: React.FC<ChipGroupRowProps> = ({
  icon,
  label,
  options,
  selected,
  onSelect,
  isLast,
}) => {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.chipRow,
        !isLast && { borderBottomWidth: 1, borderBottomColor: theme.colors.divider },
      ]}
    >
      <View style={styles.chipRowTop}>
        <View style={[styles.rowIconWrap, { backgroundColor: theme.colors.primary + "1A" }]}>
          <Ionicons name={icon} size={18} color={theme.colors.primary} />
        </View>
        <Text style={[styles.rowLabel, { color: theme.colors.text }]}>{label}</Text>
      </View>
      <View style={styles.chipList}>
        {options.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[
              styles.chip,
              {
                backgroundColor:
                  selected === opt.value ? theme.colors.primary : theme.colors.border,
                borderColor:
                  selected === opt.value ? theme.colors.primary : theme.colors.border,
              },
            ]}
            onPress={() => onSelect(opt.value)}
          >
            <Text
              style={[
                styles.chipText,
                { color: selected === opt.value ? "#FFF" : theme.colors.text },
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

// ─── Card wrapper ────────────────────────────────────────────────────────────

const Card: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
        },
      ]}
    >
      {children}
    </View>
  );
};

// ─── Main Screen ─────────────────────────────────────────────────────────────

export const ReaderSettingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { settings, updateReaderSettings, updateReaderSettingsBatch } = useSettings();

  const g = settings.reader.general;
  const d = settings.reader.display;
  const t = settings.reader.theme;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Header title="Reader Settings" onBackPress={() => navigation.goBack()} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Reading behaviour ── */}
        <SectionHeader title="Reading Behaviour" />
        <Card>
          <ToggleRow
            icon="phone-portrait-outline"
            label="Keep screen on"
            description="Prevent the screen from sleeping while reading"
            value={g.keepScreenOn}
            onValueChange={(v) => updateReaderSettings("general", "keepScreenOn", v)}
          />
          <ToggleRow
            icon="swap-horizontal-outline"
            label="Swipe left / right to navigate"
            description="Swipe to go to the next or previous chapter"
            value={g.swipeToNavigate}
            onValueChange={(v) => updateReaderSettings("general", "swipeToNavigate", v)}
          />
          <ToggleRow
            icon="hand-left-outline"
            label="Tap to scroll"
            description="Tap the right side to scroll down, left to scroll up"
            value={g.tapToScroll}
            onValueChange={(v) => updateReaderSettings("general", "tapToScroll", v)}
          />
          <ToggleRow
            icon="volume-high-outline"
            label="Volume buttons scroll"
            description="Use device volume buttons to scroll"
            value={g.volumeButtonsScroll}
            onValueChange={(v) => updateReaderSettings("general", "volumeButtonsScroll", v)}
          />
          <ToggleRow
            icon="play-circle-outline"
            label="Auto-scroll"
            description="Automatically scroll at a steady pace"
            value={g.autoScroll}
            onValueChange={(v) => updateReaderSettings("general", "autoScroll", v)}
            isLast
          />
        </Card>

        {/* ── Display ── */}
        <SectionHeader title="Display" />
        <Card>
          <ToggleRow
            icon="expand-outline"
            label="Fullscreen"
            description="Hide the status bar while reading"
            value={d.fullscreen}
            onValueChange={(v) => updateReaderSettings("display", "fullscreen", v)}
          />
          <ToggleRow
            icon="analytics-outline"
            label="Show progress %"
            description="Display reading progress at the bottom"
            value={d.showProgressPercentage}
            onValueChange={(v) => updateReaderSettings("display", "showProgressPercentage", v)}
            isLast
          />
        </Card>

        {/* ── Typography ── */}
        <SectionHeader title="Typography" />
        <Card>
          <StepperRow
            icon="text-outline"
            label="Font size"
            value={t.textSize}
            unit="px"
            min={10}
            max={40}
            step={1}
            onDecrement={() => updateReaderSettings("theme", "textSize", Math.max(10, t.textSize - 1))}
            onIncrement={() => updateReaderSettings("theme", "textSize", Math.min(40, t.textSize + 1))}
          />
          <StepperRow
            icon="reorder-four-outline"
            label="Line height"
            value={t.lineHeight}
            min={1.0}
            max={3.0}
            step={0.1}
            formatValue={(v) => v.toFixed(1)}
            onDecrement={() =>
              updateReaderSettings(
                "theme",
                "lineHeight",
                Math.round(Math.max(1.0, t.lineHeight - 0.1) * 10) / 10,
              )
            }
            onIncrement={() =>
              updateReaderSettings(
                "theme",
                "lineHeight",
                Math.round(Math.min(3.0, t.lineHeight + 0.1) * 10) / 10,
              )
            }
          />
          <StepperRow
            icon="contract-outline"
            label="Padding"
            value={t.padding}
            unit="px"
            min={0}
            max={64}
            step={2}
            onDecrement={() => updateReaderSettings("theme", "padding", Math.max(0, t.padding - 2))}
            onIncrement={() => updateReaderSettings("theme", "padding", Math.min(64, t.padding + 2))}
          />
          <ChipGroupRow
            icon="text"
            label="Text alignment"
            options={[
              { value: "left", label: "Left" },
              { value: "center", label: "Center" },
              { value: "justify", label: "Justify" },
            ]}
            selected={t.textAlign ?? "left"}
            onSelect={(v) => updateReaderSettings("theme", "textAlign", v)}
          />
          <ChipGroupRow
            icon="logo-google"
            label="Font style"
            options={[
              { value: "System", label: "System" },
              { value: "Serif", label: "Serif" },
              { value: "Sans", label: "Sans" },
              { value: "Mono", label: "Mono" },
            ]}
            selected={t.fontStyle ?? "System"}
            onSelect={(v) => updateReaderSettings("theme", "fontStyle", v)}
            isLast
          />
        </Card>

        {/* ── Theme colours (quick presets) ── */}
        <SectionHeader title="Colour Theme" />
        <Card>
          {/* Live preview */}
          <View
            style={[
              styles.preview,
              {
                backgroundColor: t.backgroundColor,
                borderBottomWidth: 1,
                borderBottomColor: theme.colors.divider,
              },
            ]}
          >
            <Text style={[styles.previewTitle, { color: t.textColor }]}>Aa</Text>
            <Text style={[styles.previewBody, { color: t.textColor }]} numberOfLines={2}>
              The quick brown fox jumps over the lazy dog.
            </Text>
          </View>
          {/* Preset chips */}
          <View style={styles.presetRow}>
            {(
              [
                { key: "Default", bg: "#FFFFFF", fg: "#000000" },
                { key: "Dark", bg: "#000000", fg: "#FFFFFF" },
                { key: "Sepia", bg: "#F4E6C4", fg: "#4A3B2A" },
                { key: "Green", bg: "#E6F4EA", fg: "#143D1F" },
              ] as const
            ).map((p) => (
              <TouchableOpacity
                key={p.key}
                style={[
                  styles.presetChip,
                  { backgroundColor: p.bg, borderColor: p.bg === t.backgroundColor ? theme.colors.primary : theme.colors.border },
                  p.bg === t.backgroundColor && styles.presetChipActive,
                ]}
                onPress={async () => {
                  // Apply all preset settings atomically using batch update
                  await updateReaderSettingsBatch([
                    { section: "theme", key: "backgroundColor", value: p.bg },
                    { section: "theme", key: "textColor", value: p.fg },
                    { section: "theme", key: "preset", value: p.key },
                  ]);
                }}
              >
                <Text style={[styles.presetChipLabel, { color: p.fg }]}>{p.key}</Text>
                {p.bg === t.backgroundColor && (
                  <Ionicons name="checkmark" size={12} color={theme.colors.primary} style={{ marginLeft: 2 }} />
                )}
              </TouchableOpacity>
            ))}
          </View>
          {/* Navigate to full theme editor */}
          <TouchableOpacity
            style={[styles.linkRow, { borderTopWidth: 1, borderTopColor: theme.colors.divider }]}
            onPress={() => (navigation as any).navigate("ReaderTheme")}
          >
            <Text style={[styles.linkText, { color: theme.colors.primary }]}>
              Advanced colour settings
            </Text>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.primary} />
          </TouchableOpacity>
        </Card>

        <View style={styles.bottomPad} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 32 },

  // Card
  card: {
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },

  // Row base
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  rowIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: "500",
  },
  rowDesc: {
    fontSize: 12,
    lineHeight: 16,
  },

  // Stepper
  stepperWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stepBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnDisabled: {
    opacity: 0.4,
  },
  stepBtnText: {
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 22,
  },
  stepValue: {
    minWidth: 48,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
  },

  // Chip group
  chipRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  chipRowTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  chipList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingLeft: 44,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
  },

  // Preview
  preview: {
    padding: 16,
  },
  previewTitle: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 4,
  },
  previewBody: {
    fontSize: 14,
    lineHeight: 22,
  },

  // Preset chips
  presetRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    padding: 16,
  },
  presetChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
  },
  presetChipActive: {
    borderWidth: 2,
  },
  presetChipLabel: {
    fontSize: 13,
    fontWeight: "700",
  },

  // Link row
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  linkText: {
    fontSize: 14,
    fontWeight: "600",
  },

  bottomPad: { height: 16 },
});