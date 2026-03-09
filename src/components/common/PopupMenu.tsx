// src/components/common/PopupMenu.tsx
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
} from "react-native";
import { useTheme } from "../../context/ThemeContext";

export interface MenuItem {
  id: string;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  isDestructive?: boolean;
}

interface PopupMenuProps {
  visible: boolean;
  onClose: () => void;
  items: MenuItem[];
  /**
   * Optional coords of the tapped button (pageX, pageY from measure()).
   * When omitted the menu anchors to the top-right corner — the correct
   * default for header "⋮" buttons.
   */
  anchorPosition?: { x: number; y: number };
}

const MENU_WIDTH = 220;
const ITEM_HEIGHT = 46;
const V_PAD = 6;
const MARGIN = 12;

export const PopupMenu: React.FC<PopupMenuProps> = ({
  visible,
  onClose,
  items,
  anchorPosition,
}) => {
  const { theme } = useTheme();
  const { width: SW, height: SH } = Dimensions.get("window");

  // ── Animation ─────────────────────────────────────────────────────────────
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 300,
          friction: 22,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0,
          duration: 90,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 90,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [opacityAnim, scaleAnim, visible]);

  // ── Position calculation ──────────────────────────────────────────────────
  const menuHeight = items.length * ITEM_HEIGHT + V_PAD * 2;

  // Default anchor: top-right of screen (header ⋮ button zone)
  const anchorX = anchorPosition?.x ?? SW - MARGIN;
  const anchorY = anchorPosition?.y ?? 56;

  // Right-align to anchor; clamp within screen
  let left = anchorX - MENU_WIDTH + 8;
  if (left + MENU_WIDTH > SW - MARGIN) left = SW - MENU_WIDTH - MARGIN;
  if (left < MARGIN) left = MARGIN;

  // Below anchor by default; flip up if too close to bottom
  let top = anchorY + 6;
  if (top + menuHeight > SH - 80) {
    top = Math.max(MARGIN, anchorY - menuHeight - 6);
  }

  // Scale origin: top-right corner so the menu "pops out" of the button
  const ox = MENU_WIDTH - 16;
  const oy = top > anchorY ? 0 : menuHeight;

  const handleItemPress = (item: MenuItem) => {
    onClose();
    setTimeout(() => item.onPress(), 80);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        {/* Menu card */}
        <Animated.View
          style={[
            styles.menu,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              top,
              left,
              opacity: opacityAnim,
              transform: [
                { translateX: ox },
                { translateY: oy },
                { scale: scaleAnim },
                { translateX: -ox },
                { translateY: -oy },
              ],
            },
          ]}
        >
          {/* Inner touch-stopper prevents backdrop dismissal on menu tap */}
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            {items.map((item, index) => {
              const isLast = index === items.length - 1;
              const textColor = item.isDestructive
                ? theme.colors.error
                : theme.colors.text;
              const iconColor = item.isDestructive
                ? theme.colors.error
                : theme.colors.textSecondary;

              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.item,
                    !isLast && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: theme.colors.divider,
                    },
                    item.isDestructive && {
                      backgroundColor: theme.colors.error + "0C",
                    },
                  ]}
                  onPress={() => handleItemPress(item)}
                  activeOpacity={0.6}
                >
                  {/* Icon slot — always present for consistent text indent */}
                  <Ionicons
                    name={item.icon ?? "ellipse-outline"}
                    size={16}
                    color={item.icon ? iconColor : "transparent"}
                    style={styles.icon}
                  />
                  <Text style={[styles.label, { color: textColor }]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.20)",
  },
  menu: {
    position: "absolute",
    width: MENU_WIDTH,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    paddingVertical: V_PAD,
    elevation: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: ITEM_HEIGHT,
    paddingHorizontal: 14,
    gap: 10,
  },
  icon: {
    width: 20,
    textAlign: "center",
  },
  label: {
    fontSize: 15,
    fontWeight: "500",
    flex: 1,
  },
});