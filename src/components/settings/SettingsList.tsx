import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "../../context/ThemeContext";

export const SettingsSection: React.FC<{
  title?: string;
  children: React.ReactNode;
}> = ({ title, children }) => {
  const { theme } = useTheme();

  return (
    <View style={styles.section}>
      {title ? (
        <Text
          style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}
        >
          {title}
        </Text>
      ) : null}
      <View
        style={[
          styles.sectionCard,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
};

export interface SettingsRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  label: string;
  subtitle?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  isLast?: boolean;
  isDestructive?: boolean;
}

export const SettingsRow: React.FC<SettingsRowProps> = ({
  icon,
  iconColor,
  label,
  subtitle,
  onPress,
  rightElement,
  isLast,
  isDestructive,
}) => {
  const { theme } = useTheme();
  const color = isDestructive
    ? theme.colors.error
    : (iconColor ?? theme.colors.primary);

  return (
    <TouchableOpacity
      style={[
        styles.row,
        !isLast && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.colors.divider,
        },
      ]}
      onPress={onPress}
      disabled={!onPress && !rightElement}
      activeOpacity={0.7}
    >
      <View style={[styles.rowIconWrap, { backgroundColor: color + "18" }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <View style={styles.rowContent}>
        <Text
          style={[
            styles.rowLabel,
            { color: isDestructive ? theme.colors.error : theme.colors.text },
          ]}
        >
          {label}
        </Text>
        {subtitle ? (
          <Text
            style={[styles.rowSubtitle, { color: theme.colors.textSecondary }]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {rightElement ??
        (onPress ? (
          <Ionicons
            name="chevron-forward"
            size={18}
            color={theme.colors.textSecondary}
          />
        ) : null)}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  section: { marginTop: 24, paddingHorizontal: 16 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12,
  },
  rowIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: "500" },
  rowSubtitle: { fontSize: 12, marginTop: 1 },
});

