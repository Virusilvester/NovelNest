// src/navigation/CustomDrawerContent.tsx
import {
  DrawerContentComponentProps,
  DrawerContentScrollView,
  DrawerItemList,
} from "@react-navigation/drawer";
import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "../context/ThemeContext";

export const CustomDrawerContent: React.FC<DrawerContentComponentProps> = (
  props,
) => {
  const { theme } = useTheme();

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
        <Image
          source={{ uri: "https://via.placeholder.com/80" }}
          style={styles.logo}
        />
        <Text style={styles.appName}>NovelNest</Text>
        <Text style={styles.version}>v1.0.0</Text>
      </View>

      <DrawerContentScrollView {...props}>
        <DrawerItemList {...props} />
      </DrawerContentScrollView>

      <View style={[styles.footer, { borderTopColor: theme.colors.divider }]}>
        <TouchableOpacity style={styles.footerItem}>
          <Text
            style={[styles.footerText, { color: theme.colors.textSecondary }]}
          >
            © 2026 NovelNest
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    height: 160,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 12,
  },
  appName: {
    color: "#FFF",
    fontSize: 24,
    fontWeight: "bold",
  },
  version: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    marginTop: 4,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
  },
  footerItem: {
    paddingVertical: 8,
  },
  footerText: {
    fontSize: 12,
    textAlign: "center",
  },
});
