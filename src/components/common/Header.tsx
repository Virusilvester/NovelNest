// src/components/common/Header.tsx
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";

interface HeaderProps {
  title: string;
  onMenuPress?: () => void;
  onBackPress?: () => void;
  rightButtons?: React.ReactNode;
  isSearchActive?: boolean;
  searchQuery?: string;
  onSearchChange?: (text: string) => void;
  onSearchSubmit?: () => void;
  onSearchClose?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  onMenuPress,
  onBackPress,
  rightButtons,
  isSearchActive = false,
  searchQuery = "",
  onSearchChange,
  onSearchSubmit,
  onSearchClose,
}) => {
  const { theme } = useTheme();

  if (isSearchActive) {
    return (
      <SafeAreaView
        edges={["top"]}
        style={{ backgroundColor: theme.colors.surface }}
      >
        <View style={styles.container}>
          <TouchableOpacity onPress={onSearchClose} style={styles.iconButton}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <TextInput
            style={[styles.searchInput, { color: theme.colors.text }]}
            placeholder="Search..."
            placeholderTextColor={theme.colors.textSecondary}
            value={searchQuery}
            onChangeText={onSearchChange}
            onSubmitEditing={onSearchSubmit}
            autoFocus
            returnKeyType="search"
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={["top"]}
      style={{ backgroundColor: theme.colors.surface }}
    >
      <View style={styles.container}>
        {onMenuPress && (
          <TouchableOpacity onPress={onMenuPress} style={styles.iconButton}>
            <Ionicons name="menu" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        )}
        {onBackPress && (
          <TouchableOpacity onPress={onBackPress} style={styles.iconButton}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        )}
        <Text
          style={[styles.title, { color: theme.colors.text }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        <View style={styles.rightContainer}>{rightButtons}</View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  iconButton: {
    padding: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: "bold",
    marginLeft: 8,
  },
  rightContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
    marginLeft: 8,
    paddingHorizontal: 8,
  },
});
