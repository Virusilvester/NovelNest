// src/screens/DownloadQueueScreen.tsx
import { useNavigation } from "@react-navigation/native";
import React from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { Header } from "../components/common/Header";
import { useTheme } from "../context/ThemeContext";

interface DownloadItem {
  id: string;
  novelTitle: string;
  chapterTitle: string;
  progress: number;
  status: "pending" | "downloading" | "completed" | "error";
}

// Mock data
const downloadQueue: DownloadItem[] = [
  {
    id: "1",
    novelTitle: "Novel 1",
    chapterTitle: "Chapter 1",
    progress: 45,
    status: "downloading",
  },
  {
    id: "2",
    novelTitle: "Novel 1",
    chapterTitle: "Chapter 2",
    progress: 0,
    status: "pending",
  },
];

export const DownloadQueueScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();

  const renderItem = ({ item }: { item: DownloadItem }) => (
    <View style={[styles.item, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.itemInfo}>
        <Text
          style={[styles.novelTitle, { color: theme.colors.text }]}
          numberOfLines={1}
        >
          {item.novelTitle}
        </Text>
        <Text
          style={[styles.chapterTitle, { color: theme.colors.textSecondary }]}
          numberOfLines={1}
        >
          {item.chapterTitle}
        </Text>
      </View>
      <View style={styles.progressContainer}>
        <View
          style={[styles.progressBar, { backgroundColor: theme.colors.border }]}
        >
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor:
                  item.status === "error"
                    ? theme.colors.error
                    : theme.colors.primary,
                width: `${item.progress}%`,
              },
            ]}
          />
        </View>
        <Text
          style={[styles.statusText, { color: theme.colors.textSecondary }]}
        >
          {item.status === "downloading" ? `${item.progress}%` : item.status}
        </Text>
      </View>
    </View>
  );

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Header title="Download Queue" onBackPress={() => navigation.goBack()} />

      <FlatList
        data={downloadQueue}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
  item: {
    padding: 16,
    marginBottom: 8,
    borderRadius: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
  },
  itemInfo: {
    marginBottom: 8,
  },
  novelTitle: {
    fontSize: 16,
    fontWeight: "bold",
  },
  chapterTitle: {
    fontSize: 14,
    marginTop: 2,
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    marginRight: 8,
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  statusText: {
    fontSize: 12,
    width: 60,
    textAlign: "right",
  },
});
