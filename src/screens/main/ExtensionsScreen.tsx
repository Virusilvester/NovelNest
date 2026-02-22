// src/screens/main/ExtensionsScreen.tsx
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React, { useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Header } from "../../components/common/Header";
import { PopupMenu } from "../../components/common/PopupMenu";
import { useTheme } from "../../context/ThemeContext";

interface Extension {
  id: string;
  name: string;
  version: string;
  language: string;
  isInstalled: boolean;
}

// Mock data
const extensions: Extension[] = [
  {
    id: "1",
    name: "English Novels",
    version: "1.0.0",
    language: "en",
    isInstalled: true,
  },
  {
    id: "2",
    name: "Japanese Light Novels",
    version: "1.2.0",
    language: "jp",
    isInstalled: false,
  },
];

type SortOption = "az" | "za";

export const ExtensionsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("az");
  const [isFilterMenuVisible, setIsFilterMenuVisible] = useState(false);

  const sortedExtensions = [...extensions].sort((a, b) => {
    if (sortOption === "az") return a.name.localeCompare(b.name);
    return b.name.localeCompare(a.name);
  });

  const renderExtension = ({ item }: { item: Extension }) => (
    <View
      style={[styles.extensionItem, { backgroundColor: theme.colors.surface }]}
    >
      <View style={styles.extensionInfo}>
        <Text style={[styles.extensionName, { color: theme.colors.text }]}>
          {item.name}
        </Text>
        <Text
          style={[styles.extensionMeta, { color: theme.colors.textSecondary }]}
        >
          v{item.version} • {item.language.toUpperCase()}
        </Text>
      </View>
      <TouchableOpacity
        style={[
          styles.actionButton,
          {
            backgroundColor: item.isInstalled
              ? theme.colors.error
              : theme.colors.primary,
          },
        ]}
      >
        <Text style={styles.actionButtonText}>
          {item.isInstalled ? "Uninstall" : "Install"}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const filterMenuItems = [
    {
      id: "az",
      label: "A-Z",
      onPress: () => setSortOption("az"),
    },
    {
      id: "za",
      label: "Z-A",
      onPress: () => setSortOption("za"),
    },
  ];

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Header
        title="Extensions"
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
            <>
              <TouchableOpacity
                onPress={() => setIsSearchActive(true)}
                style={styles.iconButton}
              >
                <Ionicons name="search" size={24} color={theme.colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setIsFilterMenuVisible(true)}
                style={styles.iconButton}
              >
                <Ionicons name="filter" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </>
          ) : null
        }
      />

      <FlatList
        data={sortedExtensions}
        renderItem={renderExtension}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
      />

      <PopupMenu
        visible={isFilterMenuVisible}
        onClose={() => setIsFilterMenuVisible(false)}
        items={filterMenuItems.map((item) => ({
          ...item,
          onPress: () => {
            item.onPress();
            setIsFilterMenuVisible(false);
          },
        }))}
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
  extensionItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    marginBottom: 8,
    borderRadius: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
  },
  extensionInfo: {
    flex: 1,
  },
  extensionName: {
    fontSize: 16,
    fontWeight: "bold",
  },
  extensionMeta: {
    fontSize: 12,
    marginTop: 4,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
  },
  actionButtonText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "bold",
  },
});
