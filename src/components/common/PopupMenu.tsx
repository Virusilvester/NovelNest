// src/components/common/PopupMenu.tsx
import React from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "../../context/ThemeContext";

interface MenuItem {
  id: string;
  label: string;
  icon?: string;
  onPress: () => void;
  isDestructive?: boolean;
}

interface PopupMenuProps {
  visible: boolean;
  onClose: () => void;
  items: MenuItem[];
  anchorPosition?: { x: number; y: number };
}

export const PopupMenu: React.FC<PopupMenuProps> = ({
  visible,
  onClose,
  items,
  anchorPosition,
}) => {
  const { theme } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.overlay} onPress={onClose}>
        <View
          style={[
            styles.menu,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              top: anchorPosition?.y || 50,
              right: 16,
            },
          ]}
        >
          {items.map((item, index) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.menuItem,
                index < items.length - 1 && {
                  borderBottomWidth: 1,
                  borderBottomColor: theme.colors.divider,
                },
              ]}
              onPress={() => {
                item.onPress();
                onClose();
              }}
            >
              <Text
                style={[
                  styles.menuItemText,
                  {
                    color: item.isDestructive
                      ? theme.colors.error
                      : theme.colors.text,
                  },
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  menu: {
    position: "absolute",
    minWidth: 200,
    borderRadius: 8,
    borderWidth: 1,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  menuItemText: {
    fontSize: 16,
  },
});
