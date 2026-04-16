// src/navigation/AppNavigator.tsx
import { NavigationContainer, useNavigationContainerRef } from "@react-navigation/native";
import { getDrawerStatusFromState } from "@react-navigation/drawer";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { Alert, BackHandler, Platform } from "react-native";
import { useSettings } from "../context/SettingsContext";
import { DownloadQueueScreen } from "../screens/DownloadQueueScreen";
import { NovelDetailScreen } from "../screens/library/NovelDetailScreen";
import { ReaderScreen } from "../screens/reader/ReaderScreen";
import { AboutSettingsScreen } from "../screens/settings/AboutSettingsScreen";
import { AdvancedSettingsScreen } from "../screens/settings/AdvancedSettingsScreen";
import { BackupSettingsScreen } from "../screens/settings/BackupSettingsScreen";
import { DataManagementScreen } from "../screens/settings/DataManagementScreen";
import { AppearanceScreen } from "../screens/settings/AppearanceScreen";
import { EditCategoriesScreen } from "../screens/settings/EditCategoriesScreen";
import { GeneralSettingsScreen } from "../screens/settings/GeneralSettingsScreen";
import { LegacyBackupScreen } from "../screens/settings/LegacyBackupScreen";
import { ReaderSettingsMenuScreen } from "../screens/settings/ReaderSettingsMenuScreen";
import { ReaderSettingsScreen } from "../screens/settings/ReaderSettingsScreen";
import { ReaderThemeScreen } from "../screens/settings/ReaderThemeScreen";
import { RemoteBackupScreen } from "../screens/settings/RemoteBackupScreen";
import { SettingsScreen } from "../screens/settings/SettingsScreen";
import { TrackingSettingsScreen } from "../screens/settings/TrackingSettingsScreen";
import { TrackingServicesScreen } from "../screens/settings/TrackingServicesScreen";
import { TTSSettingsScreen } from "../screens/settings/TTSSettingsScreen";
import { PluginReaderScreen } from "../screens/sources/PluginReaderScreen";
import { PluginNovelDetailScreen } from "../screens/sources/PluginNovelDetailScreen";
import { SourceDetailScreen } from "../screens/sources/SourceDetailScreen";
import { WebViewScreen } from "../screens/WebViewScreen";
import { MainDrawer } from "./MainDrawer";
import { RootStackParamList } from "./types";
import { getString } from "../strings/translations";

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator: React.FC = () => {
  const { settings, isReady } = useSettings();
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  const exitPromptVisibleRef = React.useRef(false);

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

  React.useEffect(() => {
    if (Platform.OS !== "android") return;

    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!navigationRef.isReady()) return false;

      // Let React Navigation (and nested navigators) handle back navigation.
      if (navigationRef.canGoBack()) return false;

      // If the drawer is open, let the drawer close first.
      try {
        const root: any = navigationRef.getRootState();
        const topRoute = root?.routes?.[root?.index ?? 0];
        if (topRoute?.name === "Main" && topRoute?.state) {
          const status = getDrawerStatusFromState(topRoute.state as any);
          if (status === "open") return false;
        }
      } catch {
        // ignore
      }

      if (settings.general.confirmExitOnBack) {
        if (exitPromptVisibleRef.current) return true;
        exitPromptVisibleRef.current = true;

        Alert.alert("Exit", "Do you want to exit NovelNest?", [
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => {
              exitPromptVisibleRef.current = false;
            },
          },
          {
            text: "Exit",
            style: "destructive",
            onPress: () => {
              exitPromptVisibleRef.current = false;
              BackHandler.exitApp();
            },
          },
        ]);
        return true;
      }

      BackHandler.exitApp();
      return true;
    });

    return () => {
      exitPromptVisibleRef.current = false;
      sub.remove();
    };
  }, [navigationRef, settings.general.confirmExitOnBack]);

  return (
    <NavigationContainer ref={navigationRef}>
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
        <Stack.Screen name="SettingsGeneral" component={GeneralSettingsScreen} />
        <Stack.Screen name="SettingsReader" component={ReaderSettingsMenuScreen} />
        <Stack.Screen name="SettingsTracking" component={TrackingSettingsScreen} />
        <Stack.Screen name="SettingsBackup" component={BackupSettingsScreen} />
        <Stack.Screen name="SettingsAdvanced" component={AdvancedSettingsScreen} />
        <Stack.Screen name="SettingsAbout" component={AboutSettingsScreen} />
        <Stack.Screen name="Appearance" component={AppearanceScreen} />
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
          options={{ title: getString("screens.dataManagement.title") }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
