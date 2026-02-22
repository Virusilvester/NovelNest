// src/App.tsx
import { StatusBar } from "expo-status-bar";
import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { LibraryProvider } from "./src/context/LibraryContext";
import { SettingsProvider } from "./src/context/SettingsContext";
import { ThemeProvider } from "./src/context/ThemeContext";
import { AppNavigator } from "./src/navigation/AppNavigator";

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <SettingsProvider>
          <LibraryProvider>
            <StatusBar style="auto" />
            <AppNavigator />
          </LibraryProvider>
        </SettingsProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
