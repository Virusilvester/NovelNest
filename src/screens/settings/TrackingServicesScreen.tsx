// src/screens/settings/TrackingServicesScreen.tsx
import { useNavigation } from "@react-navigation/native";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Header } from "../../components/common/Header";
import { useTheme } from "../../context/ThemeContext";
import { getString } from "../../strings/translations";

export const TrackingServicesScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Header
        title={getString("screens.trackingServices.title")}
        onBackPress={() => navigation.goBack()}
      />
      <View style={styles.content}>
        <Text style={{ color: theme.colors.textSecondary }}>Coming soon.</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: 16 },
});
