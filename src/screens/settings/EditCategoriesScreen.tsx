// src/screens/settings/EditCategoriesScreen.tsx
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { FlashList } from "@shopify/flash-list";
import React, { useState } from "react";
import {
  Alert,
  Platform,
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
  const [isFocused, setIsFocused] = useState(false);

  const handleAddCategory = () => {
    if (newCategoryName.trim()) {
      addCategory(newCategoryName.trim());
      setNewCategoryName("");
    }
  };

  const handleDeleteCategory = (id: string, name: string) => {
    Alert.alert(
      "Delete category",
      `Remove "${name}" from your library? Novels in this category will become uncategorised.`,
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
      style={[styles.categoryCard, { backgroundColor: theme.colors.surface }]}
    >
      {/* Drag handle (visual affordance — real DnD requires a library) */}
      <Ionicons
        name="reorder-three-outline"
        size={22}
        color={theme.colors.textSecondary}
        style={styles.dragHandle}
      />

      {/* Icon + name */}
      <View
        style={[
          styles.categoryIconWrap,
          { backgroundColor: theme.colors.primary + "18" },
        ]}
      >
        <Ionicons
          name="albums-outline"
          size={16}
          color={theme.colors.primary}
        />
      </View>
      <Text
        style={[styles.categoryName, { color: theme.colors.text }]}
        numberOfLines={1}
      >
        {item.name}
      </Text>

      {/* Delete */}
      <TouchableOpacity
        style={[
          styles.deleteBtn,
          { backgroundColor: theme.colors.error + "12" },
        ]}
        onPress={() => handleDeleteCategory(item.id, item.name)}
        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
      >
        <Ionicons name="trash-outline" size={16} color={theme.colors.error} />
      </TouchableOpacity>
    </View>
  );

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Header title="Categories" onBackPress={() => navigation.goBack()} />

      {/* Add new */}
      <View style={styles.addSection}>
        <View
          style={[
            styles.inputWrap,
            {
              backgroundColor: theme.colors.surface,
              borderColor: isFocused
                ? theme.colors.primary
                : theme.colors.border,
            },
          ]}
        >
          <Ionicons
            name="pricetag-outline"
            size={16}
            color={
              isFocused ? theme.colors.primary : theme.colors.textSecondary
            }
          />
          <TextInput
            style={[styles.input, { color: theme.colors.text }]}
            placeholder="New category name…"
            placeholderTextColor={theme.colors.textSecondary}
            value={newCategoryName}
            onChangeText={setNewCategoryName}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onSubmitEditing={handleAddCategory}
            returnKeyType="done"
          />
        </View>
        <TouchableOpacity
          style={[
            styles.addBtn,
            {
              backgroundColor: newCategoryName.trim()
                ? theme.colors.primary
                : theme.colors.border,
            },
          ]}
          onPress={handleAddCategory}
          disabled={!newCategoryName.trim()}
        >
          <Ionicons
            name="add"
            size={22}
            color={newCategoryName.trim() ? "#FFF" : theme.colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* Hint */}
      <Text style={[styles.hint, { color: theme.colors.textSecondary }]}>
        {categories.length}{" "}
        {categories.length === 1 ? "category" : "categories"}
      </Text>

      <FlashList
        data={categories}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={Platform.OS === "android"}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View
              style={[
                styles.emptyIconWrap,
                { backgroundColor: theme.colors.surface },
              ]}
            >
              <Ionicons
                name="albums-outline"
                size={42}
                color={theme.colors.textSecondary}
              />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
              No categories yet
            </Text>
            <Text
              style={[
                styles.emptySubtitle,
                { color: theme.colors.textSecondary },
              ]}
            >
              Add a category above to organise your library
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },

  addSection: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 10,
  },
  inputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 10,
  },
  input: { flex: 1, fontSize: 15 },
  addBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },

  hint: {
    fontSize: 12,
    fontWeight: "600",
    paddingHorizontal: 20,
    paddingBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  listContent: { paddingHorizontal: 16, paddingBottom: 28 },

  categoryCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    marginBottom: 10,
    borderRadius: 14,
    gap: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  dragHandle: { opacity: 0.4 },
  categoryIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  categoryName: { flex: 1, fontSize: 15, fontWeight: "600" },
  deleteBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },

  emptyContainer: { paddingTop: 48, alignItems: "center", gap: 10 },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  emptyTitle: { fontSize: 17, fontWeight: "800" },
  emptySubtitle: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 260,
  },
});
