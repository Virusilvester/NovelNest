import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../../context/ThemeContext";
import { getTracker } from "../../services/tracking/registry";
import { TrackingService } from "../../services/tracking/TrackingService";
import type { TrackerId } from "../../types";
import type { TrackerSearchResult } from "../../services/tracking/types";
import { getString } from "../../strings/translations";

type Props = {
  visible: boolean;
  trackerId: TrackerId;
  initialQuery?: string;
  onClose: () => void;
  onSelect: (result: TrackerSearchResult) => void;
};

export const TrackingSearchModal: React.FC<Props> = ({
  visible,
  trackerId,
  initialQuery,
  onClose,
  onSelect,
}) => {
  const { theme } = useTheme();
  const tracker = useMemo(() => getTracker(trackerId), [trackerId]);

  const [query, setQuery] = useState(initialQuery || "");
  const [results, setResults] = useState<TrackerSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setQuery(initialQuery || "");
    setResults([]);
    setError(null);
  }, [initialQuery, visible]);

  const canSearch = query.trim().length >= 2;

  const runSearch = useCallback(async () => {
    if (!canSearch) return;
    setIsLoading(true);
    setError(null);
    try {
      const auth = await TrackingService.ensureValidAuth(trackerId);
      const next = await tracker.handleSearch(query.trim(), auth);
      setResults(next);
    } catch (e: any) {
      setError(e?.message || getString("tracking.search.failed"));
    } finally {
      setIsLoading(false);
    }
  }, [canSearch, query, tracker, trackerId]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.container,
            { backgroundColor: theme.colors.background },
          ]}
        >
          <View
            style={[styles.header, { borderBottomColor: theme.colors.divider }]}
          >
            <Text style={[styles.title, { color: theme.colors.text }]}>
              {getString("tracking.search.title")} {tracker.name}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchRow}>
            <View
              style={[
                styles.inputWrap,
                { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
              ]}
            >
              <Ionicons
                name="search-outline"
                size={18}
                color={theme.colors.textSecondary}
              />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={getString("tracking.search.placeholder")}
                placeholderTextColor={theme.colors.textSecondary}
                style={[styles.input, { color: theme.colors.text }]}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                onSubmitEditing={() => void runSearch()}
              />
            </View>
            <TouchableOpacity
              onPress={() => void runSearch()}
              disabled={!canSearch || isLoading}
              style={[
                styles.searchBtn,
                {
                  backgroundColor: !canSearch || isLoading
                    ? theme.colors.border
                    : theme.colors.primary,
                },
              ]}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.searchBtnText}>
                  {getString("tracking.search.search")}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {error ? (
            <Text style={[styles.error, { color: theme.colors.error }]}>
              {error}
            </Text>
          ) : null}

          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
            {!isLoading && results.length === 0 ? (
              <Text style={[styles.empty, { color: theme.colors.textSecondary }]}>
                {getString("tracking.search.empty")}
              </Text>
            ) : null}
            {results.map((r) => (
              <TouchableOpacity
                key={r.id}
                style={[
                  styles.item,
                  { borderBottomColor: theme.colors.divider },
                ]}
                onPress={() => {
                  onSelect(r);
                  onClose();
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={[styles.itemTitle, { color: theme.colors.text }]}
                    numberOfLines={2}
                  >
                    {r.title}
                  </Text>
                  {typeof r.totalChapters === "number" ? (
                    <Text
                      style={[
                        styles.itemSub,
                        { color: theme.colors.textSecondary },
                      ]}
                    >
                      {getString("tracking.search.chapters")}: {r.totalChapters}
                    </Text>
                  ) : null}
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={theme.colors.textSecondary}
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  container: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "85%",
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 16, fontWeight: "800" },
  closeButton: { padding: 4 },
  searchRow: { flexDirection: "row", gap: 10, padding: 16, paddingBottom: 10 },
  inputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  input: { flex: 1, fontSize: 14 },
  searchBtn: {
    paddingHorizontal: 14,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  searchBtnText: { color: "#FFF", fontWeight: "900" },
  error: { paddingHorizontal: 16, paddingBottom: 8, fontSize: 12 },
  list: { paddingHorizontal: 0 },
  empty: { paddingHorizontal: 16, paddingVertical: 18, fontSize: 13 },
  item: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  itemTitle: { fontSize: 14, fontWeight: "700" },
  itemSub: { fontSize: 12, marginTop: 2 },
});

