// src/App.tsx
import { StatusBar } from "expo-status-bar";
import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { HistoryProvider } from "./src/context/HistoryContext";
import { LibraryProvider } from "./src/context/LibraryContext";
import { SettingsProvider } from "./src/context/SettingsContext";
import { ThemeProvider } from "./src/context/ThemeContext";
import { AppNavigator } from "./src/navigation/AppNavigator";

export default function App() {
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <ThemeProvider>
          <LibraryProvider>
            <HistoryProvider>
              <StatusBar style="auto" />
              <AppNavigator />
            </HistoryProvider>
          </LibraryProvider>
        </ThemeProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}
