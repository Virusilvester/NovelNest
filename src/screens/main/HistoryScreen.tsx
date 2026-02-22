// src/screens/main/HistoryScreen.tsx
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { format, formatDistanceToNow } from "date-fns";
import React, { useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Header } from "../../components/common/Header";
import { useTheme } from "../../context/ThemeContext";
import { Novel } from "../../types";

interface HistoryItem {
  novel: Novel;
  lastReadDate: Date;
  chapterTitle: string;
}

// Mock data
const historyItems: HistoryItem[] = [];

export const HistoryScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const formatDate = (date: Date): string => {
    const daysDiff = Math.floor(
      (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (daysDiff < 7) {
      return formatDistanceToNow(date, { addSuffix: true });
    }
    return format(date, "MMM d, yyyy");
  };

  const renderHistoryItem = ({ item }: { item: HistoryItem }) => (
    <TouchableOpacity
      style={[styles.historyItem, { backgroundColor: theme.colors.surface }]}
    >
      <View style={styles.historyContent}>
        <Text
          style={[styles.novelTitle, { color: theme.colors.text }]}
          numberOfLines={1}
        >
          {item.novel.title}
        </Text>
        <Text
          style={[styles.chapterTitle, { color: theme.colors.textSecondary }]}
          numberOfLines={1}
        >
          {item.chapterTitle}
        </Text>
        <Text style={[styles.dateText, { color: theme.colors.textSecondary }]}>
          {formatDate(item.lastReadDate)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Header
        title="History"
        onMenuPress={() => navigation.openDrawer()}
        showSearch={!isSearchActive}
        isSearchActive={isSearchActive}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={() => setIsSearchActive(true)}
        onSearchClose={() => {
          setIsSearchActive(false);
          setSearchQuery("");
        }}
        rightButtons={
          !isSearchActive ? (
            <TouchableOpacity
              onPress={() => setIsSearchActive(true)}
              style={styles.iconButton}
            >
              <Ionicons name="search" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          ) : null
        }
      />

      <FlatList
        data={historyItems}
        renderItem={renderHistoryItem}
        keyExtractor={(item, index) => `${item.novel.id}-${index}`}
        contentContainerStyle={styles.listContent}
      />
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
  listContent: {
    padding: 16,
  },
  historyItem: {
    padding: 16,
    marginBottom: 8,
    borderRadius: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
  },
  historyContent: {
    flex: 1,
  },
  novelTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
  },
  chapterTitle: {
    fontSize: 14,
    marginBottom: 4,
  },
  dateText: {
    fontSize: 12,
  },
});
