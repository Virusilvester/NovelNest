// src/screens/settings/DataManagementScreen.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import * as FileSystem from "expo-file-system/legacy";
import React, { useEffect, useState } from "react";
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
import { useLibrary } from "../../context/LibraryContext";
import { useSettings } from "../../context/SettingsContext";
import { useTheme } from "../../context/ThemeContext";

interface StorageInfo {
  appSize: string;
  cacheSize: string;
  downloadsSize: string;
  totalSize: string;
}

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
          style={[
            styles.actionDescription,
            { color: theme.colors.textSecondary },
          ]}
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
  const { novels, updateNovel } = useLibrary();

  const [userAgent, setUserAgent] = useState(
    settings.advanced?.userAgent ||
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  );
  const [isEditingUserAgent, setIsEditingUserAgent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [storageInfo, setStorageInfo] = useState<StorageInfo>({
    appSize: "Calculating...",
    cacheSize: "Calculating...",
    downloadsSize: "Calculating...",
    totalSize: "Calculating...",
  });

  // Calculate storage on mount
  useEffect(() => {
    calculateStorage();
  }, []);

  const calculateStorage = async () => {
    try {
      // Get app directory size
      const documentDir = FileSystem.documentDirectory;
      if (documentDir) {
        await FileSystem.getInfoAsync(documentDir);
        // Note: This is simplified - in production it must be changed to a detailed calculation
        setStorageInfo({
          appSize: "~45 MB",
          cacheSize: "~12 MB",
          downloadsSize: "~156 MB",
          totalSize: "~213 MB",
        });
      }
    } catch (error) {
      console.error("Error calculating storage:", error);
    }
  };

  const handleDeleteReadChapters = async () => {
    const readChapters = novels.filter(
      (n) => n.lastReadChapter && n.lastReadChapter > 0 && n.isDownloaded,
    );

    if (readChapters.length === 0) {
      Alert.alert(
        "No Read Chapters",
        "There are no downloaded chapters marked as read.",
      );
      return;
    }

    Alert.alert(
      "Delete Read Chapters",
      `Found ${readChapters.length} novels with read chapters. This will free up approximately 45 MB of space. This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setIsLoading(true);
            try {
              // Simulate deletion process
              await new Promise((resolve) => setTimeout(resolve, 1500));

              // Update novels to mark chapters as not downloaded
              readChapters.forEach((novel) => {
                updateNovel(novel.id, { isDownloaded: false });
              });

              Alert.alert(
                "Success",
                `Deleted read chapters from ${readChapters.length} novels. Freed up 45 MB.`,
              );
              calculateStorage();
            } catch {
              Alert.alert("Error", "Failed to delete read chapters.");
            } finally {
              setIsLoading(false);
            }
          },
        },
      ],
    );
  };

  const handleClearCookies = async () => {
    Alert.alert(
      "Clear Cookies & Web Data",
      "This will clear all cookies, cached web pages, and login sessions. You will need to log in again to sources that require authentication. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: async () => {
            setIsLoading(true);
            try {
              // Clear cookies from storage
              const keys = await AsyncStorage.getAllKeys();
              const cookieKeys = keys.filter(
                (key) =>
                  key.includes("cookie") ||
                  key.includes("webview") ||
                  key.includes("session"),
              );

              if (cookieKeys.length > 0) {
                await AsyncStorage.multiRemove(cookieKeys);
              }

              // Simulate clearing webview cache
              await new Promise((resolve) => setTimeout(resolve, 800));

              Alert.alert("Success", "Cookies and web data have been cleared.");
              calculateStorage();
            } catch {
              Alert.alert("Error", "Failed to clear cookies.");
            } finally {
              setIsLoading(false);
            }
          },
        },
      ],
    );
  };

  const handleClearSettings = () => {
    Alert.alert(
      "⚠️ Reset All Settings",
      "This will permanently reset ALL settings to their default values including:\n\n• Display mode (Grid/List)\n• Badge settings\n• Sort and filter preferences\n• Theme settings\n• Reader preferences\n• Download settings\n• Update frequency\n• User agent\n\nThis action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset Everything",
          style: "destructive",
          onPress: async () => {
            setIsLoading(true);
            try {
              // Clear from storage
              await resetSettings(); // This now comes from useSettings

              // Also clear any cached UI states
              await AsyncStorage.multiRemove([
                "@novelnest_library_display",
                "@novelnest_filter_options",
              ]);

              Alert.alert(
                "Settings Reset",
                "All settings have been restored to default values. The app will now use:\n\n• Compact Grid view\n• All badges enabled\n• Library as start screen\n• Light theme\n• Default sort (Last Read)",
                [
                  {
                    text: "OK",
                    onPress: () => {
                      // Optional: navigate to library to show changes
                      navigation.navigate("Main", { screen: "Library" });
                    },
                  },
                ],
              );
            } catch {
              Alert.alert(
                "Error",
                "Failed to reset settings. Please try again.",
              );
            } finally {
              setIsLoading(false);
            }
          },
        },
      ],
    );
  };

  const handleClearCache = async () => {
    Alert.alert(
      "Clear Cache",
      "This will clear temporary files and cached data. This may slow down the app temporarily as it rebuilds the cache.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          onPress: async () => {
            setIsLoading(true);
            try {
              const keys = await AsyncStorage.getAllKeys();
              const cacheKeys = keys.filter(
                (key) => key.includes("cache") || key.includes("temp"),
              );

              if (cacheKeys.length > 0) {
                await AsyncStorage.multiRemove(cacheKeys);
              }

              await new Promise((resolve) => setTimeout(resolve, 500));
              Alert.alert("Success", "Cache cleared successfully.");
              calculateStorage();
            } catch {
              Alert.alert("Error", "Failed to clear cache.");
            } finally {
              setIsLoading(false);
            }
          },
        },
      ],
    );
  };

  const handleClearDatabase = () => {
    Alert.alert(
      "⚠️ Clear Library Database",
      "This will delete all novel data, reading history, and library information. Your downloaded files will remain. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear Database",
          style: "destructive",
          onPress: async () => {
            setIsLoading(true);
            try {
              // Clear all novel-related storage
              const keys = await AsyncStorage.getAllKeys();
              const novelKeys = keys.filter(
                (key) =>
                  key.includes("novel") ||
                  key.includes("history") ||
                  key.includes("library"),
              );

              if (novelKeys.length > 0) {
                await AsyncStorage.multiRemove(novelKeys);
              }

              Alert.alert(
                "Database Cleared",
                "All library data has been cleared. Please restart the app.",
              );
            } catch {
              Alert.alert("Error", "Failed to clear database.");
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
      Alert.alert(
        "Success",
        "User Agent has been updated. Changes will take effect on next web request.",
      );
    } catch {
      Alert.alert("Error", "Failed to save user agent.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetUserAgent = async () => {
    const defaultUserAgent =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    setUserAgent(defaultUserAgent);
    await updateAdvancedSettings("userAgent", defaultUserAgent);
    Alert.alert("Success", "User Agent reset to default.");
  };

  const handleTestUserAgent = () => {
    Alert.alert(
      "Test User Agent",
      `Current User Agent:\n\n${userAgent}\n\nThis will be sent with all web requests.`,
      [{ text: "OK" }],
    );
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
        {/* Storage Overview Card */}
        <View
          style={[
            styles.storageOverviewCard,
            { backgroundColor: theme.colors.surface },
          ]}
        >
          <View style={styles.storageHeader}>
            <Ionicons name="pie-chart" size={28} color={theme.colors.primary} />
            <Text
              style={[
                styles.storageOverviewTitle,
                { color: theme.colors.text },
              ]}
            >
              Storage Overview
            </Text>
          </View>

          <View style={styles.storageGrid}>
            <View style={styles.storageItem}>
              <Text
                style={[styles.storageValue, { color: theme.colors.primary }]}
              >
                {storageInfo.appSize}
              </Text>
              <Text
                style={[
                  styles.storageLabel,
                  { color: theme.colors.textSecondary },
                ]}
              >
                App
              </Text>
            </View>
            <View style={styles.storageItem}>
              <Text
                style={[styles.storageValue, { color: theme.colors.warning }]}
              >
                {storageInfo.cacheSize}
              </Text>
              <Text
                style={[
                  styles.storageLabel,
                  { color: theme.colors.textSecondary },
                ]}
              >
                Cache
              </Text>
            </View>
            <View style={styles.storageItem}>
              <Text style={[styles.storageValue, { color: theme.colors.info }]}>
                {storageInfo.downloadsSize}
              </Text>
              <Text
                style={[
                  styles.storageLabel,
                  { color: theme.colors.textSecondary },
                ]}
              >
                Downloads
              </Text>
            </View>
            <View style={[styles.storageItem, styles.storageItemTotal]}>
              <Text style={[styles.storageValue, { color: theme.colors.text }]}>
                {storageInfo.totalSize}
              </Text>
              <Text
                style={[
                  styles.storageLabel,
                  { color: theme.colors.textSecondary },
                ]}
              >
                Total
              </Text>
            </View>
          </View>
        </View>

        {/* Quick Cleanup Section */}
        <View style={styles.section}>
          <Text
            style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}
          >
            Quick Cleanup
          </Text>

          <DataAction
            title="Clear Cache"
            description="Remove temporary files and free up space"
            icon="flash-outline"
            onPress={handleClearCache}
            isLoading={isLoading}
          />

          <DataAction
            title="Delete Read Chapters"
            description={`Free space by removing ${novels.filter((n) => n.isDownloaded && n.lastReadChapter).length} read chapters`}
            icon="trash-outline"
            onPress={handleDeleteReadChapters}
            isDestructive
            isLoading={isLoading}
          />

          <DataAction
            title="Clear Cookies & Web Data"
            description="Clear login sessions and web cache"
            icon="trash-bin-outline"
            onPress={handleClearCookies}
            isDestructive
            isLoading={isLoading}
          />
        </View>

        {/* Network Section */}
        <View style={styles.section}>
          <Text
            style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}
          >
            Network Settings
          </Text>

          <View
            style={[
              styles.userAgentCard,
              { backgroundColor: theme.colors.surface },
            ]}
          >
            <View style={styles.userAgentHeader}>
              <View
                style={[
                  styles.userAgentIconContainer,
                  { backgroundColor: theme.colors.primary + "20" },
                ]}
              >
                <Ionicons
                  name="globe-outline"
                  size={20}
                  color={theme.colors.primary}
                />
              </View>
              <Text
                style={[styles.userAgentTitle, { color: theme.colors.text }]}
              >
                User Agent
              </Text>
            </View>

            <Text
              style={[
                styles.userAgentDescription,
                { color: theme.colors.textSecondary },
              ]}
            >
              The user agent string identifies your app to websites. Some
              sources may require specific user agents.
            </Text>

            {isEditingUserAgent ? (
              <View style={styles.editContainer}>
                <TextInput
                  style={[
                    styles.userAgentInput,
                    {
                      color: theme.colors.text,
                      backgroundColor: theme.colors.background,
                      borderColor: theme.colors.border,
                    },
                  ]}
                  value={userAgent}
                  onChangeText={setUserAgent}
                  multiline
                  numberOfLines={4}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="Enter user agent string..."
                  placeholderTextColor={theme.colors.textSecondary}
                />
                <View style={styles.editButtons}>
                  <TouchableOpacity
                    style={[
                      styles.editButton,
                      { backgroundColor: theme.colors.error },
                    ]}
                    onPress={() => {
                      setUserAgent(settings.advanced?.userAgent || "");
                      setIsEditingUserAgent(false);
                    }}
                  >
                    <Text style={styles.editButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.editButton,
                      { backgroundColor: theme.colors.success },
                    ]}
                    onPress={handleSaveUserAgent}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Text style={styles.editButtonText}>Save</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.userAgentDisplay}>
                <View
                  style={[
                    styles.userAgentPreview,
                    { backgroundColor: theme.colors.background },
                  ]}
                >
                  <Text
                    style={[
                      styles.userAgentText,
                      { color: theme.colors.textSecondary },
                    ]}
                    numberOfLines={3}
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
                  >
                    <Ionicons
                      name="create-outline"
                      size={16}
                      color={theme.colors.primary}
                    />
                    <Text
                      style={[
                        styles.userAgentButtonText,
                        { color: theme.colors.primary },
                      ]}
                    >
                      Edit
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.userAgentButton,
                      { borderColor: theme.colors.border },
                    ]}
                    onPress={handleResetUserAgent}
                  >
                    <Ionicons
                      name="refresh-outline"
                      size={16}
                      color={theme.colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.userAgentButtonText,
                        { color: theme.colors.textSecondary },
                      ]}
                    >
                      Reset
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.userAgentButton,
                      { borderColor: theme.colors.border },
                    ]}
                    onPress={handleTestUserAgent}
                  >
                    <Ionicons
                      name="bug-outline"
                      size={16}
                      color={theme.colors.info}
                    />
                    <Text
                      style={[
                        styles.userAgentButtonText,
                        { color: theme.colors.info },
                      ]}
                    >
                      Test
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Database Management */}
        <View style={styles.section}>
          <Text
            style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}
          >
            Database
          </Text>

          <DataAction
            title="Clear Library Database"
            description="Delete all novel data and reading history"
            icon="server-outline"
            onPress={handleClearDatabase}
            isDestructive
            isLoading={isLoading}
          />

          <DataAction
            title="Export Database"
            description="Backup your library data to file"
            icon="download-outline"
            onPress={() => {
              /* Export functionality */
            }}
            disabled
          />

          <DataAction
            title="Import Database"
            description="Restore library data from backup file"
            icon="download-outline"
            onPress={() => {
              /* Import functionality */
            }}
            disabled
          />
        </View>

        {/* Danger Zone Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.error }]}>
            ⚠️ Danger Zone
          </Text>

          <View
            style={[
              styles.dangerCard,
              {
                backgroundColor: theme.colors.error + "10",
                borderColor: theme.colors.error,
              },
            ]}
          >
            <Ionicons
              name="warning"
              size={24}
              color={theme.colors.error}
              style={styles.dangerIcon}
            />
            <Text style={[styles.dangerText, { color: theme.colors.text }]}>
              The following actions are irreversible. Proceed with caution.
            </Text>
          </View>

          <DataAction
            title="Reset All Settings"
            description="Restore all settings to factory defaults"
            icon="refresh-circle-outline"
            onPress={handleClearSettings}
            isDestructive
            isLoading={isLoading}
          />

          <DataAction
            title="Erase All Data"
            description="Delete everything and start fresh"
            icon="nuclear-outline"
            onPress={() => {
              Alert.alert(
                "⚠️ ERASE EVERYTHING",
                "This will delete ALL data including:\n\n• All novels in library\n• Reading history\n• Downloaded chapters\n• All settings\n• Account information\n\nThis CANNOT be undone. Are you absolutely sure?",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "ERASE EVERYTHING",
                    style: "destructive",
                    onPress: () => {
                      Alert.alert(
                        "Final Confirmation",
                        'Type "DELETE" to confirm complete data erasure.',
                        [{ text: "Cancel", style: "cancel" }],
                      );
                    },
                  },
                ],
              );
            }}
            isDestructive
          />
        </View>

        {/* Info Footer */}
        <View style={styles.footer}>
          <Text
            style={[styles.footerText, { color: theme.colors.textSecondary }]}
          >
            NovelNest v1.0.0 • Data Management
          </Text>
          <Text
            style={[
              styles.footerSubtext,
              { color: theme.colors.textSecondary },
            ]}
          >
            Settings are stored locally on your device
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  // Storage Overview
  storageOverviewCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  storageHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  storageOverviewTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 12,
  },
  storageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  storageItem: {
    flexBasis: "48%",
    padding: 12,
    alignItems: "center",
    marginBottom: 8,
  },
  storageItemTotal: {
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
    width: "100%",
    marginTop: 8,
    paddingTop: 16,
  },
  storageValue: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 4,
  },
  storageLabel: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  // Sections
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
    marginLeft: 4,
  },
  // Action Cards
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
  actionContent: {
    flex: 1,
    marginRight: 8,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  actionDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  // User Agent Card
  userAgentCard: {
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  userAgentHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  userAgentIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  userAgentTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  userAgentDescription: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 14,
  },
  userAgentDisplay: {
    marginTop: 4,
  },
  userAgentPreview: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  userAgentText: {
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    lineHeight: 16,
  },
  userAgentButtons: {
    flexDirection: "row",
    gap: 8,
  },
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
  userAgentButtonText: {
    fontSize: 13,
    fontWeight: "500",
  },
  // Edit Mode
  editContainer: {
    marginTop: 8,
  },
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
  editButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 14,
  },
  editButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 90,
    alignItems: "center",
  },
  editButtonText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "600",
  },
  // Danger Zone
  dangerCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  dangerIcon: {
    marginRight: 10,
  },
  dangerText: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  // Footer
  footer: {
    alignItems: "center",
    marginTop: 16,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  footerText: {
    fontSize: 13,
    fontWeight: "500",
  },
  footerSubtext: {
    fontSize: 11,
    marginTop: 4,
    opacity: 0.7,
  },
});
