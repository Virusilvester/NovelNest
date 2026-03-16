// src/navigation/AppNavigator.tsx
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { useSettings } from "../context/SettingsContext";
import { DownloadQueueScreen } from "../screens/DownloadQueueScreen";
import { NovelDetailScreen } from "../screens/library/NovelDetailScreen";
import { ReaderScreen } from "../screens/reader/ReaderScreen";
import { DataManagementScreen } from "../screens/settings/DataManagementScreen";
import { EditCategoriesScreen } from "../screens/settings/EditCategoriesScreen";
import { LegacyBackupScreen } from "../screens/settings/LegacyBackupScreen";
import { ReaderSettingsScreen } from "../screens/settings/ReaderSettingsScreen";
import { ReaderThemeScreen } from "../screens/settings/ReaderThemeScreen";
import { RemoteBackupScreen } from "../screens/settings/RemoteBackupScreen";
import { SettingsScreen } from "../screens/settings/SettingsScreen";
import { TrackingServicesScreen } from "../screens/settings/TrackingServicesScreen";
import { TTSSettingsScreen } from "../screens/settings/TTSSettingsScreen";
import { PluginReaderScreen } from "../screens/sources/PluginReaderScreen";
import { PluginNovelDetailScreen } from "../screens/sources/PluginNovelDetailScreen";
import { SourceDetailScreen } from "../screens/sources/SourceDetailScreen";
import { WebViewScreen } from "../screens/WebViewScreen";
import { MainDrawer } from "./MainDrawer";
import { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator: React.FC = () => {
  const { settings, isReady } = useSettings();

  const drawerInitialRoute = React.useMemo(() => {
    const start = settings.general.startScreen;
    switch (start) {
      case "updates":
        return "Updates";
      case "history":
        return "History";
      case "sources":
        return "Sources";
      case "library":
      default:
        return "Library";
    }
  }, [settings.general.startScreen]);

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="Main">
          {() => (
            <MainDrawer
              key={isReady ? drawerInitialRoute : "boot"}
              initialRouteName={drawerInitialRoute as any}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="NovelDetail" component={NovelDetailScreen} />
        <Stack.Screen name="SourceDetail" component={SourceDetailScreen} />
        <Stack.Screen name="Reader" component={ReaderScreen} />
        <Stack.Screen name="WebView" component={WebViewScreen} />
        <Stack.Screen
          name="PluginNovelDetail"
          component={PluginNovelDetailScreen}
        />
        <Stack.Screen name="PluginReader" component={PluginReaderScreen} />
        <Stack.Screen name="DownloadQueue" component={DownloadQueueScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="EditCategories" component={EditCategoriesScreen} />
        <Stack.Screen name="ReaderSettings" component={ReaderSettingsScreen} />
        <Stack.Screen name="ReaderTheme" component={ReaderThemeScreen} />
        <Stack.Screen name="TTSSettings" component={TTSSettingsScreen} />
        <Stack.Screen
          name="TrackingServices"
          component={TrackingServicesScreen}
        />
        <Stack.Screen name="RemoteBackup" component={RemoteBackupScreen} />
        <Stack.Screen name="LegacyBackup" component={LegacyBackupScreen} />
        <Stack.Screen
          name="DataManagement"
          component={DataManagementScreen}
          options={{ title: "Data Management" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
