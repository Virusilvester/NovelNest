// src/components/common/PopupMenu.tsx
import React, { useEffect, useRef, useState } from "react";
import { Dimensions, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
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
  const menuRef = useRef<View>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 50, left: 16 });
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

  useEffect(() => {
    if (visible && anchorPosition) {
      // Calculate optimal menu position
      const menuWidth = 200;
      const menuHeight = items.length * 48 + 16; // Approximate height
      
      let top = anchorPosition.y + 8;
      let left = anchorPosition.x - 16; // Position to the right of anchor
      
      // Ensure menu stays within screen bounds
      if (left + menuWidth > screenWidth - 16) {
        left = screenWidth - menuWidth - 16; // Adjust if too far right
      }
      if (left < 16) left = 16; // Ensure not too far left
      if (top + menuHeight > screenHeight - 100) {
        top = anchorPosition.y - menuHeight - 8; // Show above if too low
      }
      if (top < 50) top = 50; // Ensure not too high
      
      setMenuPosition({ top, left });
    }
  }, [visible, anchorPosition, items.length, screenWidth, screenHeight]);

  const handleOverlayPress = (e: any) => {
    // Prevent the press from propagating to menu items
    e.stopPropagation();
    onClose();
  };

  const handleMenuItemPress = (item: MenuItem) => {
    // Use setTimeout to prevent immediate onClose from interfering with onPress
    setTimeout(() => {
      item.onPress();
    }, 0);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableOpacity 
        style={styles.overlay} 
        onPress={handleOverlayPress}
        activeOpacity={1}
      >
        <TouchableOpacity
          ref={menuRef}
          style={[
            styles.menu,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              top: menuPosition.top,
              left: menuPosition.left,
            },
          ]}
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
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
              onPress={() => handleMenuItemPress(item)}
              activeOpacity={0.7}
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
        </TouchableOpacity>
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
