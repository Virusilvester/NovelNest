// src/screens/WebViewScreen.tsx
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import React, { useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { WebView } from "react-native-webview";
import { Header } from "../components/common/Header";
import { useTheme } from "../context/ThemeContext";

export const WebViewScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { theme } = useTheme();
  const { url } = route.params as { url: string };

  const webViewRef = useRef<any>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [currentUrl, setCurrentUrl] = useState(url);

  // Extract hostname for title display
  let hostname = url;
  try { hostname = new URL(url).hostname.replace(/^www\./, ""); } catch {}

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Header
        title={hostname}
        onBackPress={() => navigation.goBack()}
        rightButtons={[
          <TouchableOpacity
            key="refresh"
            style={styles.iconBtn}
            onPress={() => webViewRef.current?.reload()}
          >
            <Ionicons name="refresh-outline" size={20} color={theme.colors.text} />
          </TouchableOpacity>,
        ]}
      />

      {/* Loading progress bar */}
      {loading && (
        <View style={[styles.progressBar, { backgroundColor: theme.colors.border }]}>
          <View
            style={[
              styles.progressFill,
              { backgroundColor: theme.colors.primary, width: `${loadProgress * 100}%` },
            ]}
          />
        </View>
      )}

      <WebView
        ref={webViewRef}
        source={{ uri: url }}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onLoadProgress={({ nativeEvent }) => setLoadProgress(nativeEvent.progress)}
        onNavigationStateChange={(state) => {
          setCanGoBack(state.canGoBack);
          setCanGoForward(state.canGoForward);
          setCurrentUrl(state.url);
        }}
      />

      {/* Bottom nav bar */}
      <View style={[styles.navBar, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
        <TouchableOpacity
          style={[styles.navBtn, !canGoBack && styles.navBtnDisabled]}
          onPress={() => webViewRef.current?.goBack()}
          disabled={!canGoBack}
        >
          <Ionicons name="chevron-back" size={22} color={canGoBack ? theme.colors.text : theme.colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navBtn, !canGoForward && styles.navBtnDisabled]}
          onPress={() => webViewRef.current?.goForward()}
          disabled={!canGoForward}
        >
          <Ionicons name="chevron-forward" size={22} color={canGoForward ? theme.colors.text : theme.colors.textSecondary} />
        </TouchableOpacity>

        <View style={styles.urlPill}>
          <Ionicons name="lock-closed-outline" size={11} color={theme.colors.textSecondary} />
          <Text style={[styles.urlText, { color: theme.colors.textSecondary }]} numberOfLines={1}>
            {"  "}{(() => { try { return new URL(currentUrl).hostname; } catch { return currentUrl; } })()}
          </Text>
          {loading && <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginLeft: 6 }} />}
        </View>

        <TouchableOpacity style={styles.navBtn} onPress={() => webViewRef.current?.reload()}>
          <Ionicons name="refresh-outline" size={20} color={theme.colors.text} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.navBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="close-outline" size={22} color={theme.colors.text} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  webview: { flex: 1 },
  iconBtn: { padding: 8 },

  progressBar: { height: 2, width: "100%" },
  progressFill: { height: "100%", borderRadius: 999 },

  navBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  navBtn: { padding: 10 },
  navBtnDisabled: { opacity: 0.35 },
  urlPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginHorizontal: 4,
  },
  urlText: { flex: 1, fontSize: 12 },
});