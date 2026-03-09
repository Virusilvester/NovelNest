// src/screens/settings/DataManagementScreen.tsx
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { Header } from "../../components/common/Header";
import { useHistory } from "../../context/HistoryContext";
import { useLibrary } from "../../context/LibraryContext";
import { useSettings } from "../../context/SettingsContext";
import { useTheme } from "../../context/ThemeContext";
import { DatabaseService } from "../../services/database";

interface DataActionProps {
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  isDestructive?: boolean;
  isLoading?: boolean;
  disabled?: boolean;
}

const DataAction: React.FC<DataActionProps> = ({
  title,
  description,
  icon,
  onPress,
  isDestructive = false,
  isLoading = false,
  disabled = false,
}) => {
  const { theme } = useTheme();

  return (
    <TouchableOpacity
      style={[
        styles.actionCard,
        { backgroundColor: theme.colors.surface },
        isDestructive && { borderColor: theme.colors.error, borderWidth: 1 },
        (disabled || isLoading) && { opacity: 0.6 },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={disabled || isLoading}
    >
      <View
        style={[
          styles.iconContainer,
          {
            backgroundColor: isDestructive
              ? theme.colors.error + "20"
              : theme.colors.primary + "20",
          },
        ]}
      >
        {isLoading ? (
          <ActivityIndicator
            size="small"
            color={isDestructive ? theme.colors.error : theme.colors.primary}
          />
        ) : (
          <Ionicons
            name={icon}
            size={24}
            color={isDestructive ? theme.colors.error : theme.colors.primary}
          />
        )}
      </View>
      <View style={styles.actionContent}>
        <Text
          style={[
            styles.actionTitle,
            { color: isDestructive ? theme.colors.error : theme.colors.text },
          ]}
        >
          {title}
        </Text>
        <Text
          style={[styles.actionDescription, { color: theme.colors.textSecondary }]}
        >
          {description}
        </Text>
      </View>
      <Ionicons
        name="chevron-forward"
        size={20}
        color={theme.colors.textSecondary}
      />
    </TouchableOpacity>
  );
};

export const DataManagementScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { settings, updateAdvancedSettings, resetSettings } = useSettings();
  const library = useLibrary();
  const history = useHistory();

  const [userAgent, setUserAgent] = useState(settings.advanced.userAgent);
  const [isEditingUserAgent, setIsEditingUserAgent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isEditingUserAgent) {
      setUserAgent(settings.advanced.userAgent);
    }
  }, [settings.advanced.userAgent, isEditingUserAgent]);

  const stats = useMemo(() => {
    return {
      novels: library.novels.length,
      categories: library.categories.length,
      history: history.historyEntries.length,
    };
  }, [library.novels.length, library.categories.length, history.historyEntries.length]);

  const handleClearDatabase = () => {
    Alert.alert(
      "Clear Library Database",
      "This will delete your library novels and reading history (settings stay). Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            setIsLoading(true);
            try {
              await DatabaseService.replaceAll({
                categories: [],
                novels: [],
                history: [],
              });
              await Promise.all([
                library.reloadFromDatabase(),
                history.reloadFromDatabase(),
              ]);
              Alert.alert("Done", "Library database cleared.");
            } catch (e: any) {
              Alert.alert("Failed", e?.message || "Could not clear database.");
            } finally {
              setIsLoading(false);
            }
          },
        },
      ],
    );
  };

  const handleResetSettings = () => {
    Alert.alert(
      "Reset Settings",
      "Reset all settings back to defaults?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            setIsLoading(true);
            try {
              await resetSettings();
              Alert.alert("Done", "Settings reset.");
            } catch (e: any) {
              Alert.alert("Failed", e?.message || "Could not reset settings.");
            } finally {
              setIsLoading(false);
            }
          },
        },
      ],
    );
  };

  const handleSaveUserAgent = async () => {
    if (!userAgent.trim()) {
      Alert.alert("Error", "User agent cannot be empty.");
      return;
    }
    setIsLoading(true);
    try {
      await updateAdvancedSettings("userAgent", userAgent.trim());
      setIsEditingUserAgent(false);
      Alert.alert("Saved", "User agent updated.");
    } catch (e: any) {
      Alert.alert("Failed", e?.message || "Could not save user agent.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetUserAgent = async () => {
    setIsLoading(true);
    try {
      const defaultUA = settings.advanced.userAgent;
      setUserAgent(defaultUA);
      await updateAdvancedSettings("userAgent", defaultUA);
      Alert.alert("Done", "User agent reset.");
    } catch (e: any) {
      Alert.alert("Failed", e?.message || "Could not reset user agent.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Header title="Data Management" onBackPress={() => navigation.goBack()} />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.statsCard, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.statsHeader}>
            <Ionicons name="server-outline" size={22} color={theme.colors.primary} />
            <Text style={[styles.statsTitle, { color: theme.colors.text }]}>
              Database
            </Text>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statsItem}>
              <Text style={[styles.statsValue, { color: theme.colors.text }]}>
                {stats.novels}
              </Text>
              <Text style={[styles.statsLabel, { color: theme.colors.textSecondary }]}>
                Novels
              </Text>
            </View>
            <View style={styles.statsItem}>
              <Text style={[styles.statsValue, { color: theme.colors.text }]}>
                {stats.categories}
              </Text>
              <Text style={[styles.statsLabel, { color: theme.colors.textSecondary }]}>
                Categories
              </Text>
            </View>
            <View style={styles.statsItem}>
              <Text style={[styles.statsValue, { color: theme.colors.text }]}>
                {stats.history}
              </Text>
              <Text style={[styles.statsLabel, { color: theme.colors.textSecondary }]}>
                History
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
            User Agent
          </Text>

          <View style={[styles.userAgentCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.userAgentHeader}>
              <View
                style={[
                  styles.userAgentIconContainer,
                  { backgroundColor: theme.colors.primary + "20" },
                ]}
              >
                <Ionicons name="globe-outline" size={18} color={theme.colors.primary} />
              </View>
              <Text style={[styles.userAgentTitle, { color: theme.colors.text }]}>
                Web requests
              </Text>
            </View>

            <Text style={[styles.userAgentDescription, { color: theme.colors.textSecondary }]}>
              Some sources require a specific user agent string.
            </Text>

            {!isEditingUserAgent ? (
              <View style={styles.userAgentDisplay}>
                <View
                  style={[
                    styles.userAgentPreview,
                    { backgroundColor: theme.colors.background },
                  ]}
                >
                  <Text
                    style={[styles.userAgentText, { color: theme.colors.textSecondary }]}
                  >
                    {userAgent}
                  </Text>
                </View>
                <View style={styles.userAgentButtons}>
                  <TouchableOpacity
                    style={[
                      styles.userAgentButton,
                      { borderColor: theme.colors.border },
                    ]}
                    onPress={() => setIsEditingUserAgent(true)}
                    disabled={isLoading}
                  >
                    <Ionicons name="create-outline" size={16} color={theme.colors.primary} />
                    <Text
                      style={[styles.userAgentButtonText, { color: theme.colors.primary }]}
                    >
                      Edit
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.userAgentButton,
                      { borderColor: theme.colors.border },
                    ]}
                    onPress={() => void handleResetUserAgent()}
                    disabled={isLoading}
                  >
                    <Ionicons name="refresh-outline" size={16} color={theme.colors.primary} />
                    <Text
                      style={[styles.userAgentButtonText, { color: theme.colors.primary }]}
                    >
                      Reset
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.editContainer}>
                <TextInput
                  style={[
                    styles.userAgentInput,
                    {
                      color: theme.colors.text,
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.background,
                    },
                  ]}
                  value={userAgent}
                  onChangeText={setUserAgent}
                  multiline
                  editable={!isLoading}
                />

                <View style={styles.editButtons}>
                  <TouchableOpacity
                    style={[styles.editButton, { backgroundColor: theme.colors.border }]}
                    onPress={() => {
                      setIsEditingUserAgent(false);
                      setUserAgent(settings.advanced.userAgent);
                    }}
                    disabled={isLoading}
                  >
                    <Text style={[styles.editButtonText, { color: theme.colors.text }]}>
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.editButton, { backgroundColor: theme.colors.primary }]}
                    onPress={() => void handleSaveUserAgent()}
                    disabled={isLoading}
                  >
                    <Text style={styles.editButtonText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
            Danger Zone
          </Text>

          <DataAction
            title="Clear library database"
            description="Delete novels + history (keeps settings)"
            icon="trash-outline"
            onPress={handleClearDatabase}
            isDestructive
            isLoading={isLoading}
          />

          <DataAction
            title="Reset settings"
            description="Restore all settings to defaults"
            icon="warning-outline"
            onPress={handleResetSettings}
            isDestructive
            isLoading={isLoading}
          />
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 32 },

  statsCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
  },
  statsHeader: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  statsTitle: { fontSize: 18, fontWeight: "bold", marginLeft: 12 },
  statsGrid: { flexDirection: "row", justifyContent: "space-between" },
  statsItem: { alignItems: "center", flex: 1 },
  statsValue: { fontSize: 20, fontWeight: "bold", marginBottom: 4 },
  statsLabel: { fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 },

  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
    marginLeft: 4,
  },

  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  actionContent: { flex: 1, marginRight: 8 },
  actionTitle: { fontSize: 16, fontWeight: "600", marginBottom: 4 },
  actionDescription: { fontSize: 12, lineHeight: 16 },

  userAgentCard: {
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  userAgentHeader: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  userAgentIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  userAgentTitle: { fontSize: 16, fontWeight: "600" },
  userAgentDescription: { fontSize: 12, lineHeight: 18, marginBottom: 14 },
  userAgentDisplay: { marginTop: 4 },
  userAgentPreview: { padding: 12, borderRadius: 8, marginBottom: 12 },
  userAgentText: {
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    lineHeight: 16,
  },
  userAgentButtons: { flexDirection: "row", gap: 8 },
  userAgentButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    flex: 1,
    justifyContent: "center",
  },
  userAgentButtonText: { fontSize: 13, fontWeight: "500" },
  editContainer: { marginTop: 8 },
  userAgentInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    lineHeight: 18,
    minHeight: 100,
    textAlignVertical: "top",
  },
  editButtons: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 14 },
  editButton: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, minWidth: 90, alignItems: "center" },
  editButtonText: { color: "#FFF", fontSize: 14, fontWeight: "600" },

  footer: { alignItems: "center", marginTop: 12, paddingTop: 12 },
  footerText: { fontSize: 11, opacity: 0.7, textAlign: "center" },
});
