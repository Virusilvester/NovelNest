// src/navigation/AppNavigator.tsx
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { DownloadQueueScreen } from "../screens/DownloadQueueScreen";
import { NovelDetailScreen } from "../screens/library/NovelDetailScreen";
import { ReaderScreen } from "../screens/reader/ReaderScreen";
import { DataManagementScreen } from "../screens/settings/DataManagementScreen";
import { EditCategoriesScreen } from "../screens/settings/EditCategoriesScreen";
import { ReaderSettingsScreen } from "../screens/settings/ReaderSettingsScreen";
import { ReaderThemeScreen } from "../screens/settings/ReaderThemeScreen";
import { SettingsScreen } from "../screens/settings/SettingsScreen";
import { SourceDetailScreen } from "../screens/sources/SourceDetailScreen";
import { WebViewScreen } from "../screens/WebViewScreen";
import { MainDrawer } from "./MainDrawer";
import { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator: React.FC = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="Main" component={MainDrawer} />
        <Stack.Screen name="NovelDetail" component={NovelDetailScreen} />
        <Stack.Screen name="SourceDetail" component={SourceDetailScreen} />
        <Stack.Screen name="Reader" component={ReaderScreen} />
        <Stack.Screen name="WebView" component={WebViewScreen} />
        <Stack.Screen name="DownloadQueue" component={DownloadQueueScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="EditCategories" component={EditCategoriesScreen} />
        <Stack.Screen name="ReaderSettings" component={ReaderSettingsScreen} />
        <Stack.Screen name="ReaderTheme" component={ReaderThemeScreen} />
        <Stack.Screen
          name="DataManagement"
          component={DataManagementScreen}
          options={{ title: "Data Management" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
