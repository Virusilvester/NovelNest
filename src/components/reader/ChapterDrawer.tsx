// src/components/reader/ChapterDrawer.tsx
import { Ionicons } from "@expo/vector-icons";
import { FlashList, ListRenderItem } from "@shopify/flash-list";
import React, { useMemo, useState } from "react";
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";

export type ReaderChapterItem = {
  name: string;
  path: string;
};

type Props = {
  visible: boolean;
  title?: string;
  chapters: ReaderChapterItem[];
  currentPath: string;
  onClose: () => void;
  onSelect: (chapter: ReaderChapterItem, index: number) => void;
};

export const ChapterDrawer: React.FC<Props> = ({
  visible,
  title = "Chapters",
  chapters,
  currentPath,
  onClose,
  onSelect,
}) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return chapters;
    return chapters.filter((c) => c.name.toLowerCase().includes(q));
  }, [chapters, query]);

  const renderItem: ListRenderItem<ReaderChapterItem> = ({ item, index }) => {
    const isActive = item.path === currentPath;
    return (
      <TouchableOpacity
        style={[
          styles.row,
          { borderBottomColor: theme.colors.divider },
          isActive && { backgroundColor: theme.colors.primary + "18" },
        ]}
        onPress={() => onSelect(item, index)}
      >
        <Text
          style={[
            styles.rowText,
            { color: theme.colors.text },
            isActive && { fontWeight: "800" },
          ]}
          numberOfLines={2}
        >
          {item.name || "(untitled)"}
        </Text>
        {isActive ? (
          <Ionicons
            name="radio-button-on"
            size={18}
            color={theme.colors.primary}
          />
        ) : (
          <Ionicons
            name="chevron-forward"
            size={18}
            color={theme.colors.textSecondary}
          />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={[
            styles.panel,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              paddingTop: Math.max(insets.top, 12),
              paddingBottom: Math.max(insets.bottom, 12),
            },
          ]}
          onPress={() => {}}
        >
          <View style={styles.header}>
            <Text
              style={[styles.title, { color: theme.colors.text }]}
              numberOfLines={1}
            >
              {title}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.iconBtn}>
              <Ionicons name="close" size={22} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <View
            style={[styles.searchWrap, { borderColor: theme.colors.border }]}
          >
            <Ionicons
              name="search"
              size={16}
              color={theme.colors.textSecondary}
            />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search chapters…"
              placeholderTextColor={theme.colors.textSecondary}
              style={[styles.searchInput, { color: theme.colors.text }]}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {!!query && (
              <TouchableOpacity
                onPress={() => setQuery("")}
                style={styles.iconBtnSmall}
              >
                <Ionicons
                  name="close-circle"
                  size={18}
                  color={theme.colors.textSecondary}
                />
              </TouchableOpacity>
            )}
          </View>

          <FlashList
            data={filtered}
            keyExtractor={(item, index) => `${item.path}:${index}`}
            keyboardShouldPersistTaps="handled"
            renderItem={renderItem}
            removeClippedSubviews={Platform.OS === "android"}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  panel: {
    width: 320,
    maxWidth: "88%",
    borderRightWidth: 1,
    height: "100%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: "800",
    paddingRight: 12,
  },
  iconBtn: { padding: 8 },
  iconBtnSmall: { padding: 4 },
  searchWrap: {
    marginHorizontal: 12,
    marginBottom: 10,
    paddingHorizontal: 10,
    height: 38,
    borderWidth: 1,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
  },
  row: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  rowText: { flex: 1, fontSize: 13, lineHeight: 18 },
});
