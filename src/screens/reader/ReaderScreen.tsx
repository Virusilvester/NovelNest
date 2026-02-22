// src/screens/reader/ReaderScreen.tsx
import { useNavigation, useRoute } from "@react-navigation/native";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Header } from "../../components/common/Header";
import { useTheme } from "../../context/ThemeContext";

export const ReaderScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { theme } = useTheme();

  const { novelId, chapterId } = route.params as {
    novelId: string;
    chapterId: string;
  };

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Header title="Reader" onBackPress={() => navigation.goBack()} />
      <View style={styles.content}>
        <Text style={{ color: theme.colors.text }}>Chapter Content Here</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
});
