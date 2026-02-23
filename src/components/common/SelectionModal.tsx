// src/components/common/SelectionModal.tsx
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../../context/ThemeContext";

interface SelectionOption {
  label: string;
  value: string;
}

interface SelectionModalProps {
  visible: boolean;
  title: string;
  options: SelectionOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}

export const SelectionModal: React.FC<SelectionModalProps> = ({
  visible,
  title,
  options,
  selectedValue,
  onSelect,
  onClose,
}) => {
  const { theme } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.container,
            { backgroundColor: theme.colors.background },
          ]}
        >
          <View
            style={[styles.header, { borderBottomColor: theme.colors.divider }]}
          >
            <Text style={[styles.title, { color: theme.colors.text }]}>
              {title}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.optionsList}>
            {options.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.option,
                  { borderBottomColor: theme.colors.divider },
                  selectedValue === option.value && {
                    backgroundColor: theme.colors.primary + "20",
                  },
                ]}
                onPress={() => {
                  onSelect(option.value);
                  onClose();
                }}
              >
                <Text
                  style={[
                    styles.optionText,
                    { color: theme.colors.text },
                    selectedValue === option.value && {
                      color: theme.colors.primary,
                      fontWeight: "bold",
                    },
                  ]}
                >
                  {option.label}
                </Text>
                {selectedValue === option.value && (
                  <Ionicons
                    name="checkmark"
                    size={20}
                    color={theme.colors.primary}
                  />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  container: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
  },
  closeButton: {
    padding: 4,
  },
  optionsList: {
    paddingVertical: 8,
  },
  option: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
  },
  optionText: {
    fontSize: 16,
  },
});
