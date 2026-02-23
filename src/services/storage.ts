// src/services/storage.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppSettings, DEFAULT_SETTINGS } from "../types";

const SETTINGS_KEY = "@novelnest_settings";

export const StorageService = {
  // Save settings to persistent storage
  saveSettings: async (settings: AppSettings): Promise<void> => {
    try {
      const jsonValue = JSON.stringify(settings);
      await AsyncStorage.setItem(SETTINGS_KEY, jsonValue);
      console.log("Settings saved successfully");
    } catch (error) {
      console.error("Error saving settings:", error);
      throw error;
    }
  },

  // Load settings from persistent storage
  loadSettings: async (): Promise<AppSettings> => {
    try {
      const jsonValue = await AsyncStorage.getItem(SETTINGS_KEY);
      if (jsonValue != null) {
        const parsed = JSON.parse(jsonValue);
        // Merge with defaults to ensure all fields exist
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
      return DEFAULT_SETTINGS;
    } catch (error) {
      console.error("Error loading settings:", error);
      return DEFAULT_SETTINGS;
    }
  },

  // Clear all settings (reset to default)
  clearSettings: async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(SETTINGS_KEY);
      console.log("Settings cleared successfully");
    } catch (error) {
      console.error("Error clearing settings:", error);
      throw error;
    }
  },

  // Clear specific data keys
  clearData: async (keys: string[]): Promise<void> => {
    try {
      await AsyncStorage.multiRemove(keys);
      console.log("Data cleared:", keys);
    } catch (error) {
      console.error("Error clearing data:", error);
      throw error;
    }
  },
};
