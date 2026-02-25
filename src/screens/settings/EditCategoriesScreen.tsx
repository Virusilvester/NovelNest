// src/screens/settings/EditCategoriesScreen.tsx
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React, { useState } from "react";
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Header } from "../../components/common/Header";
import { useLibrary } from "../../context/LibraryContext";
import { useTheme } from "../../context/ThemeContext";

export const EditCategoriesScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { categories, addCategory, removeCategory } = useLibrary();
  const [newCategoryName, setNewCategoryName] = useState("");

  const handleAddCategory = () => {
    if (newCategoryName.trim()) {
      addCategory(newCategoryName.trim());
      setNewCategoryName("");
    }
  };

  const handleDeleteCategory = (id: string, name: string) => {
    Alert.alert(
      "Delete Category",
      `Are you sure you want to delete "${name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => removeCategory(id),
        },
      ],
    );
  };

  const renderItem = ({
    item,
    index,
  }: {
    item: (typeof categories)[0];
    index: number;
  }) => (
    <View
      style={[styles.categoryItem, { backgroundColor: theme.colors.surface }]}
    >
      <Text style={[styles.categoryName, { color: theme.colors.text }]}>
        {item.name}
      </Text>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons
            name="reorder-three"
            size={24}
            color={theme.colors.textSecondary}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleDeleteCategory(item.id, item.name)}
        >
          <Ionicons name="trash-outline" size={24} color={theme.colors.error} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Header title="Edit Categories" onBackPress={() => navigation.goBack()} />

      <View style={styles.inputContainer}>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.colors.surface,
              color: theme.colors.text,
              borderColor: theme.colors.border,
            },
          ]}
          placeholder="New category name"
          placeholderTextColor={theme.colors.textSecondary}
          value={newCategoryName}
          onChangeText={setNewCategoryName}
        />
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: theme.colors.primary }]}
          onPress={handleAddCategory}
        >
          <Ionicons name="add" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={categories}
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
  inputContainer: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
  },
  input: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    padding: 16,
  },
  categoryItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    marginBottom: 8,
    borderRadius: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: "bold",
  },
  actions: {
    flexDirection: "row",
    gap: 16,
  },
  actionButton: {
    padding: 4,
  },
});
