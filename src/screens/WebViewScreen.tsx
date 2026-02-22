// src/screens/WebViewScreen.tsx
import { useNavigation, useRoute } from "@react-navigation/native";
import React from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { Header } from "../components/common/Header";
import { useTheme } from "../context/ThemeContext";

export const WebViewScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { theme } = useTheme();

  const { url } = route.params as { url: string };

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Header title="WebView" onBackPress={() => navigation.goBack()} />
      <WebView
        source={{ uri: url }}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
});
