// src/components/common/FilterPanel.tsx
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  Dimensions,
  Modal,
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

const { width, height } = Dimensions.get("window");

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
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} />

        <View
          style={[
            styles.container,
            { backgroundColor: theme.colors.background },
          ]}
        >
          {/* Header */}
          <View
            style={[styles.header, { backgroundColor: theme.colors.surface }]}
          >
            <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
              Filter & Sort
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Filter Section */}
            <View style={styles.section}>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: theme.colors.textSecondary },
                ]}
              >
                Filter
              </Text>
              <View
                style={[
                  styles.sectionCard,
                  { backgroundColor: theme.colors.surface },
                ]}
              >
                <FilterSwitch
                  label="Downloaded only"
                  value={filterOptions.downloaded}
                  onChange={(v) =>
                    onFilterChange({ ...filterOptions, downloaded: v })
                  }
                />
                <FilterSwitch
                  label="Unread only"
                  value={filterOptions.unread}
                  onChange={(v) =>
                    onFilterChange({ ...filterOptions, unread: v })
                  }
                />
                <FilterSwitch
                  label="Completed only"
                  value={filterOptions.completed}
                  onChange={(v) =>
                    onFilterChange({ ...filterOptions, completed: v })
                  }
                  isLast
                />
              </View>
            </View>

            {/* Sort Section */}
            <View style={styles.section}>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: theme.colors.textSecondary },
                ]}
              >
                Sort By
              </Text>
              <View
                style={[
                  styles.sectionCard,
                  { backgroundColor: theme.colors.surface },
                ]}
              >
                {LIBRARY_SORT_OPTIONS.map((option, index) => (
                  <SortOption
                    key={option.value}
                    label={option.label}
                    selected={sortOption === option.value}
                    onPress={() => onSortChange(option.value)}
                    isLast={index === LIBRARY_SORT_OPTIONS.length - 1}
                  />
                ))}
              </View>
            </View>

            {/* Display Mode Section */}
            <View style={styles.section}>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: theme.colors.textSecondary },
                ]}
              >
                Display Mode
              </Text>
              <View
                style={[
                  styles.sectionCard,
                  { backgroundColor: theme.colors.surface },
                ]}
              >
                <DisplayModeOption
                  label="Compact Grid"
                  icon="grid-outline"
                  selected={displayMode === "compactGrid"}
                  onPress={() => onDisplayModeChange("compactGrid")}
                />
                <DisplayModeOption
                  label="List"
                  icon="list-outline"
                  selected={displayMode === "list"}
                  onPress={() => onDisplayModeChange("list")}
                  isLast
                />
              </View>
            </View>

            {/* Badge Settings Section */}
            <View style={styles.section}>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: theme.colors.textSecondary },
                ]}
              >
                Badges
              </Text>
              <View
                style={[
                  styles.sectionCard,
                  { backgroundColor: theme.colors.surface },
                ]}
              >
                <FilterSwitch
                  label="Show download badges"
                  value={showDownloadBadges}
                  onChange={onShowDownloadBadgesChange}
                />
                <FilterSwitch
                  label="Show unread badges"
                  value={showUnreadBadges}
                  onChange={onShowUnreadBadgesChange}
                />
                <FilterSwitch
                  label="Show item count"
                  value={showItemCount}
                  onChange={onShowItemCountChange}
                  isLast
                />
              </View>
            </View>

            {/* Spacer for bottom padding */}
            <View style={styles.bottomSpacer} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// Sub-components
const FilterSwitch: React.FC<{
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  isLast?: boolean;
}> = ({ label, value, onChange, isLast }) => {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.switchRow,
        !isLast && {
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.divider,
        },
      ]}
    >
      <Text style={[styles.switchLabel, { color: theme.colors.text }]}>
        {label}
      </Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
        thumbColor={value ? "#FFF" : "#f4f3f4"}
      />
    </View>
  );
};

const SortOption: React.FC<{
  label: string;
  selected: boolean;
  onPress: () => void;
  isLast?: boolean;
}> = ({ label, selected, onPress, isLast }) => {
  const { theme } = useTheme();

  return (
    <TouchableOpacity
      style={[
        styles.sortRow,
        !isLast && {
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.divider,
        },
        selected && { backgroundColor: theme.colors.primary + "10" },
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.sortLabel,
          { color: selected ? theme.colors.primary : theme.colors.text },
          selected && { fontWeight: "600" },
        ]}
      >
        {label}
      </Text>
      {selected && (
        <Ionicons name="checkmark" size={20} color={theme.colors.primary} />
      )}
    </TouchableOpacity>
  );
};

const DisplayModeOption: React.FC<{
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  selected: boolean;
  onPress: () => void;
  isLast?: boolean;
}> = ({ label, icon, selected, onPress, isLast }) => {
  const { theme } = useTheme();

  return (
    <TouchableOpacity
      style={[
        styles.displayModeRow,
        !isLast && {
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.divider,
        },
        selected && { backgroundColor: theme.colors.primary + "10" },
      ]}
      onPress={onPress}
    >
      <View style={styles.displayModeLeft}>
        <Ionicons
          name={icon}
          size={20}
          color={selected ? theme.colors.primary : theme.colors.textSecondary}
          style={styles.displayModeIcon}
        />
        <Text
          style={[
            styles.displayModeLabel,
            { color: selected ? theme.colors.primary : theme.colors.text },
            selected && { fontWeight: "600" },
          ]}
        >
          {label}
        </Text>
      </View>
      {selected && (
        <View
          style={[styles.radioButton, { borderColor: theme.colors.primary }]}
        >
          <View
            style={[
              styles.radioButtonInner,
              { backgroundColor: theme.colors.primary },
            ]}
          />
        </View>
      )}
      {!selected && (
        <View
          style={[styles.radioButton, { borderColor: theme.colors.border }]}
        />
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  backdrop: {
    flex: 1,
  },
  container: {
    maxHeight: height * 0.85,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    paddingTop: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionCard: {
    borderRadius: 12,
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
  },
  switchLabel: {
    fontSize: 15,
  },
  sortRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
  },
  sortLabel: {
    fontSize: 15,
  },
  displayModeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
  },
  displayModeLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  displayModeIcon: {
    marginRight: 12,
  },
  displayModeLabel: {
    fontSize: 15,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  bottomSpacer: {
    height: 30,
  },
});
