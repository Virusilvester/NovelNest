// src/screens/main/UpdatesScreen.tsx
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { FlashList } from "@shopify/flash-list";
import React, { useState } from "react";
import {
  Image,
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

// Replace with real data from context/service
const recentUpdates: Novel[] = [];

export const UpdatesScreen: React.FC = () => {
  const navigation = useNavigation<MainDrawerNavigationProp>();
  const { theme } = useTheme();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    // TODO: trigger real update check
    setTimeout(() => setIsRefreshing(false), 1500);
  };

  const renderUpdateItem = ({ item }: { item: Novel }) => (
    <TouchableOpacity
      style={[styles.updateItem, { backgroundColor: theme.colors.surface }]}
      activeOpacity={0.8}
    >
      {item.coverUrl ? (
        <Image source={{ uri: item.coverUrl }} style={styles.cover} resizeMode="cover" />
      ) : (
        <View style={[styles.coverPlaceholder, { backgroundColor: theme.colors.border }]}>
          <Ionicons name="book-outline" size={22} color={theme.colors.textSecondary} />
        </View>
      )}
      <View style={styles.updateInfo}>
        <Text style={[styles.updateTitle, { color: theme.colors.text }]} numberOfLines={1}>
          {item.title}
        </Text>
        <View style={styles.updateMeta}>
          <Ionicons name="sparkles-outline" size={12} color={theme.colors.primary} />
          <Text style={[styles.updateMetaText, { color: theme.colors.textSecondary }]}>
            {" "}New chapters available
          </Text>
        </View>
      </View>
      <View style={[styles.newBadge, { backgroundColor: theme.colors.primary }]}>
        <Text style={styles.newBadgeText}>NEW</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Header
        title="Updates"
        onMenuPress={() => navigation.openDrawer()}
        rightButtons={
          <TouchableOpacity
            onPress={handleRefresh}
            style={styles.iconBtn}
            disabled={isRefreshing}
          >
            <Ionicons
              name="refresh-outline"
              size={22}
              color={isRefreshing ? theme.colors.textSecondary : theme.colors.text}
            />
          </TouchableOpacity>
        }
      />

      {recentUpdates.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIconWrap, { backgroundColor: theme.colors.surface }]}>
            <Ionicons name="newspaper-outline" size={48} color={theme.colors.textSecondary} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
            All caught up!
          </Text>
          <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
            No new chapter updates found.{"\n"}Pull down to check again.
          </Text>
          <TouchableOpacity
            style={[styles.checkBtn, { backgroundColor: theme.colors.primary }]}
            onPress={handleRefresh}
            disabled={isRefreshing}
          >
            <Ionicons name="refresh-outline" size={16} color="#FFF" />
            <Text style={styles.checkBtnText}>Check for updates</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlashList
          data={recentUpdates}
          keyExtractor={(item) => item.id}
          renderItem={renderUpdateItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={Platform.OS === "android"}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  iconBtn: { padding: 8 },
  listContent: { padding: 16, paddingBottom: 28 },

  // Item
  updateItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    marginBottom: 10,
    borderRadius: 14,
    gap: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  cover: { width: 46, height: 68, borderRadius: 7 },
  coverPlaceholder: {
    width: 46,
    height: 68,
    borderRadius: 7,
    justifyContent: "center",
    alignItems: "center",
  },
  updateInfo: { flex: 1 },
  updateTitle: { fontSize: 14, fontWeight: "700", marginBottom: 4 },
  updateMeta: { flexDirection: "row", alignItems: "center" },
  updateMetaText: { fontSize: 12 },
  newBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  newBadgeText: { color: "#FFF", fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },

  // Empty
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
    gap: 12,
  },
  emptyIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  emptyTitle: { fontSize: 20, fontWeight: "800" },
  emptySubtitle: { fontSize: 14, textAlign: "center", lineHeight: 22, opacity: 0.7 },
  checkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  checkBtnText: { color: "#FFF", fontWeight: "700", fontSize: 14 },
});