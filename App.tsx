// src/App.tsx
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ErrorBoundary } from "./src/components/common/ErrorBoundary";
import { DownloadQueueProvider } from "./src/context/DownloadQueueContext";
import { HistoryProvider } from "./src/context/HistoryContext";
import { LibraryProvider } from "./src/context/LibraryContext";
import { SettingsProvider } from "./src/context/SettingsContext";
import { ThemeProvider } from "./src/context/ThemeContext";
import { UpdatesProvider } from "./src/context/UpdatesContext";
import { AppNavigator } from "./src/navigation/AppNavigator";
import { AndroidProgressNotifications } from "./src/services/androidProgressNotifications";
import { FirstInstallService } from "./src/services/firstInstall";

export default function App() {
  useEffect(() => {
    void AndroidProgressNotifications.dismissStaleNotification();
    void FirstInstallService.runOnce();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SettingsProvider>
          <ThemeProvider>
            <LibraryProvider>
              <DownloadQueueProvider>
                <UpdatesProvider>
                  <HistoryProvider>
                    <StatusBar style="auto" />
                    <ErrorBoundary>
                      <AppNavigator />
                    </ErrorBoundary>
                  </HistoryProvider>
                </UpdatesProvider>
              </DownloadQueueProvider>
            </LibraryProvider>
          </ThemeProvider>
        </SettingsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
