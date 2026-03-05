// src/App.tsx
import { StatusBar } from "expo-status-bar";
import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ErrorBoundary } from "./src/components/common/ErrorBoundary";
import { DownloadQueueProvider } from "./src/context/DownloadQueueContext";
import { HistoryProvider } from "./src/context/HistoryContext";
import { LibraryProvider } from "./src/context/LibraryContext";
import { SettingsProvider } from "./src/context/SettingsContext";
import { ThemeProvider } from "./src/context/ThemeContext";
import { AppNavigator } from "./src/navigation/AppNavigator";

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SettingsProvider>
          <ThemeProvider>
            <LibraryProvider>
              <DownloadQueueProvider>
                <HistoryProvider>
                  <StatusBar style="auto" />
                  <ErrorBoundary>
                    <AppNavigator />
                  </ErrorBoundary>
                </HistoryProvider>
              </DownloadQueueProvider>
            </LibraryProvider>
          </ThemeProvider>
        </SettingsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
