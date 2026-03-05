// src/screens/main/UpdatesScreen.tsx
import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { useNavigation } from "@react-navigation/native";
import React from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Header } from "../../components/common/Header";
import { useTheme } from "../../context/ThemeContext";
import type { MainDrawerNavigationProp } from "../../navigation/navigationTypes";
import { Novel } from "../../types";

// Mock data - replace with actual data from context/service
const recentUpdates: Novel[] = [];

export const UpdatesScreen: React.FC = () => {
  const navigation = useNavigation<MainDrawerNavigationProp>();
  const { theme } = useTheme();

  const handleRefresh = () => {
    // Implementation for refreshing updates
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={[styles.emptyEmoji, { color: theme.colors.textSecondary }]}>
        (@o@;)
      </Text>
      <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
        No recent updates
      </Text>
    </View>
  );

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Header
        title="Updates"
        onMenuPress={() => navigation.openDrawer()}
        rightButtons={
          <TouchableOpacity onPress={handleRefresh} style={styles.iconButton}>
            <Ionicons name="refresh" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        }
      />

      {recentUpdates.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlashList
          data={recentUpdates}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.updateItem,
                { backgroundColor: theme.colors.surface },
              ]}
            >
              {/* Update item content */}
            </TouchableOpacity>
          )}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={Platform.OS === "android"}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  iconButton: {
    padding: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
  },
  updateItem: {
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 8,
  },
});
