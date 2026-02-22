// src/components/common/FilterPanel.tsx
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LIBRARY_SORT_OPTIONS } from "../../constants";
import { useTheme } from "../../context/ThemeContext";
import {
  DisplayMode,
  LibraryFilterOption,
  LibrarySortOption,
} from "../../types";

interface FilterPanelProps {
  visible: boolean;
  onClose: () => void;
  filterOptions: LibraryFilterOption;
  onFilterChange: (options: LibraryFilterOption) => void;
  sortOption: LibrarySortOption;
  onSortChange: (option: LibrarySortOption) => void;
  displayMode: DisplayMode;
  onDisplayModeChange: (mode: DisplayMode) => void;
  showDownloadBadges: boolean;
  onShowDownloadBadgesChange: (show: boolean) => void;
  showUnreadBadges: boolean;
  onShowUnreadBadgesChange: (show: boolean) => void;
  showItemCount: boolean;
  onShowItemCountChange: (show: boolean) => void;
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
  visible,
  onClose,
  filterOptions,
  onFilterChange,
  sortOption,
  onSortChange,
  displayMode,
  onDisplayModeChange,
  showDownloadBadges,
  onShowDownloadBadgesChange,
  showUnreadBadges,
  onShowUnreadBadgesChange,
  showItemCount,
  onShowItemCountChange,
}) => {
  const { theme } = useTheme();

  if (!visible) return null;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          Filter & Sort
        </Text>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close" size={24} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <Section title="Filter">
          <FilterItem
            label="Downloaded"
            value={filterOptions.downloaded}
            onChange={(v) =>
              onFilterChange({ ...filterOptions, downloaded: v })
            }
            theme={theme}
          />
          <FilterItem
            label="Unread"
            value={filterOptions.unread}
            onChange={(v) => onFilterChange({ ...filterOptions, unread: v })}
            theme={theme}
          />
          <FilterItem
            label="Completed"
            value={filterOptions.completed}
            onChange={(v) => onFilterChange({ ...filterOptions, completed: v })}
            theme={theme}
          />
        </Section>

        <Section title="Sort by">
          {LIBRARY_SORT_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={styles.sortOption}
              onPress={() => onSortChange(option.value)}
            >
              <Text style={[styles.sortLabel, { color: theme.colors.text }]}>
                {option.label}
              </Text>
              {sortOption === option.value && (
                <Ionicons
                  name="arrow-up"
                  size={20}
                  color={theme.colors.primary}
                />
              )}
            </TouchableOpacity>
          ))}
        </Section>

        <Section title="Display">
          <FilterItem
            label="Download badges"
            value={showDownloadBadges}
            onChange={onShowDownloadBadgesChange}
            theme={theme}
          />
          <FilterItem
            label="Unread badges"
            value={showUnreadBadges}
            onChange={onShowUnreadBadgesChange}
            theme={theme}
          />
          <FilterItem
            label="Show number of items"
            value={showItemCount}
            onChange={onShowItemCountChange}
            theme={theme}
          />
        </Section>

        <Section title="Display mode">
          <View style={styles.radioGroup}>
            <RadioButton
              label="Compact grid"
              selected={displayMode === "compactGrid"}
              onPress={() => onDisplayModeChange("compactGrid")}
              theme={theme}
            />
            <RadioButton
              label="List"
              selected={displayMode === "list"}
              onPress={() => onDisplayModeChange("list")}
              theme={theme}
            />
          </View>
        </Section>
      </ScrollView>
    </View>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => {
  const { theme } = useTheme();
  return (
    <View style={styles.section}>
      <Text
        style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}
      >
        {title}
      </Text>
      {children}
    </View>
  );
};

const FilterItem: React.FC<{
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  theme: any;
}> = ({ label, value, onChange, theme }) => (
  <View style={styles.filterItem}>
    <Text style={[styles.filterLabel, { color: theme.colors.text }]}>
      {label}
    </Text>
    <Switch
      value={value}
      onValueChange={onChange}
      trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
    />
  </View>
);

const RadioButton: React.FC<{
  label: string;
  selected: boolean;
  onPress: () => void;
  theme: any;
}> = ({ label, selected, onPress, theme }) => (
  <TouchableOpacity style={styles.radioButton} onPress={onPress}>
    <View
      style={[
        styles.radioCircle,
        {
          borderColor: theme.colors.primary,
          backgroundColor: selected ? theme.colors.primary : "transparent",
        },
      ]}
    />
    <Text style={[styles.radioLabel, { color: theme.colors.text }]}>
      {label}
    </Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    right: 0,
    top: 56,
    width: 300,
    height: "100%",
    elevation: 16,
    shadowColor: "#000",
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    zIndex: 1000,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  sectionTitle: {
    fontSize: 12,
    textTransform: "uppercase",
    marginBottom: 12,
    fontWeight: "600",
  },
  filterItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  filterLabel: {
    fontSize: 16,
  },
  sortOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  sortLabel: {
    fontSize: 16,
  },
  radioGroup: {
    gap: 12,
  },
  radioButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    marginRight: 12,
  },
  radioLabel: {
    fontSize: 16,
  },
});
