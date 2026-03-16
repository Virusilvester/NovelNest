// src/navigation/MainDrawer.tsx
import { Ionicons } from "@expo/vector-icons";
import { createDrawerNavigator } from "@react-navigation/drawer";
import React from "react";
import { useWindowDimensions } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { DownloadQueueScreen } from "../screens/DownloadQueueScreen";
import { ExtensionsScreen } from "../screens/main/ExtensionsScreen";
import { HistoryScreen } from "../screens/main/HistoryScreen";
import { LibraryScreen } from "../screens/main/LibraryScreen";
import { SourcesScreen } from "../screens/main/SourcesScreen";
import { UpdatesScreen } from "../screens/main/UpdatesScreen";
import { SettingsScreen } from "../screens/settings/SettingsScreen";
import { getDrawerWidth } from "../utils/responsive";
import { CustomDrawerContent } from "./CustomDrawerContent";
import { MainDrawerParamList } from "./types";

const Drawer = createDrawerNavigator<MainDrawerParamList>();

export const MainDrawer: React.FC<{
  initialRouteName?: keyof MainDrawerParamList;
}> = ({ initialRouteName }) => {
  const { width, height } = useWindowDimensions();
  const { theme } = useTheme();
  const drawerWidth = getDrawerWidth(width, height);

  return (
    <Drawer.Navigator
      initialRouteName={initialRouteName ?? "Library"}
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: "front",
        overlayColor: "rgba(0,0,0,0.5)",
        drawerStyle: {
          width: drawerWidth,
          backgroundColor: theme.colors.background,
        },
        drawerActiveTintColor: theme.colors.primary,
        drawerInactiveTintColor: theme.colors.text,
        drawerActiveBackgroundColor: theme.colors.primary + "20",
      }}
    >
      <Drawer.Screen
        name="Library"
        component={LibraryScreen}
        options={{
          drawerIcon: ({ color }) => (
            <Ionicons name="library" size={24} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="Updates"
        component={UpdatesScreen}
        options={{
          drawerIcon: ({ color }) => (
            <Ionicons name="notifications" size={24} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="History"
        component={HistoryScreen}
        options={{
          drawerIcon: ({ color }) => (
            <Ionicons name="time" size={24} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="Sources"
        component={SourcesScreen}
        options={{
          drawerIcon: ({ color }) => (
            <Ionicons name="globe" size={24} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="Extensions"
        component={ExtensionsScreen}
        options={{
          drawerIcon: ({ color }) => (
            <Ionicons name="cube" size={24} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="DownloadQueue"
        component={DownloadQueueScreen}
        options={{
          drawerIcon: ({ color }) => (
            <Ionicons name="download" size={24} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          drawerIcon: ({ color }) => (
            <Ionicons name="settings" size={24} color={color} />
          ),
        }}
      />
    </Drawer.Navigator>
  );
};
