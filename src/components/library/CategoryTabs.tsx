// src/components/library/CategoryTabs.tsx
import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { Category } from "../../types";

interface CategoryTabsProps {
  categories: Category[];
  selectedId: string;
  onSelect: (id: string) => void;
  getItemCount: (categoryId: string) => number;
  showItemCount: boolean;
}

export const CategoryTabs: React.FC<CategoryTabsProps> = ({
  categories,
  selectedId,
  onSelect,
  getItemCount,
  showItemCount,
}) => {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {categories.map((category) => {
          const isSelected = category.id === selectedId;
          const count = getItemCount(category.id);

          return (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.tab,
                isSelected && { backgroundColor: theme.colors.primary },
              ]}
              onPress={() => onSelect(category.id)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: isSelected ? "#FFF" : theme.colors.text },
                ]}
                numberOfLines={1}
              >
                {category.name}
              </Text>
              {showItemCount && count > 0 && (
                <View
                  style={[
                    styles.badge,
                    {
                      backgroundColor: isSelected
                        ? "rgba(255,255,255,0.3)"
                        : theme.colors.primary,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      { color: isSelected ? "#FFF" : "#FFF" },
                    ]}
                  >
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  scrollContent: {
    paddingHorizontal: 8,
    paddingVertical: 12,
    gap: 8,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginHorizontal: 4,
    backgroundColor: "rgba(0,0,0,0.05)",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 6,
    paddingHorizontal: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "bold",
  },
});
