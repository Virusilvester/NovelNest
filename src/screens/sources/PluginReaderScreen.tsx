import type { RouteProp } from "@react-navigation/native";
import { useNavigation, useRoute } from "@react-navigation/native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import RenderHTML from "react-native-render-html";
import { Header } from "../../components/common/Header";
import { useSettings } from "../../context/SettingsContext";
import { useTheme } from "../../context/ThemeContext";
import type { RootStackParamList } from "../../navigation/types";
import { PluginRuntimeService } from "../../services/pluginRuntime";

export const PluginReaderScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, "PluginReader">>();
  const { theme } = useTheme();
  const { settings } = useSettings();
  const { width } = useWindowDimensions();

  const { pluginId, chapterPath, chapterTitle } = route.params;
  const installed = settings.extensions.installedPlugins || {};
  const plugin = installed[pluginId];

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [html, setHtml] = useState<string>("");

  useEffect(() => {
    const run = async () => {
      if (!plugin) {
        setError("Plugin not installed.");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        const instance = await PluginRuntimeService.loadLnReaderPlugin(plugin, {
          userAgent: settings.advanced.userAgent,
        });

        if (!instance.parseChapter) {
          throw new Error("This plugin does not support chapter parsing.");
        }

        const content = await instance.parseChapter(chapterPath);
        setHtml(content || "");
      } catch (e: any) {
        setError(e?.message || "Failed to load chapter.");
      } finally {
        setIsLoading(false);
      }
    };
    run();
  }, [chapterPath, plugin, settings.advanced.userAgent]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Header title={chapterTitle || "Reader"} onBackPress={() => navigation.goBack()} />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={[styles.centerText, { color: theme.colors.textSecondary }]}>
            Loading…
          </Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <RenderHTML
            contentWidth={width - 32}
            source={{ html: html || "<p>(empty)</p>" }}
            baseStyle={{ color: theme.colors.text, lineHeight: 22, fontSize: 16 }}
          />
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 10 },
  centerText: { fontSize: 12 },
  errorText: { fontSize: 13, textAlign: "center" },
  content: { padding: 16, paddingBottom: 32 },
});

