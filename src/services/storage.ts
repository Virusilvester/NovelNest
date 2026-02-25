// src/services/storage.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppSettings, DEFAULT_SETTINGS } from "../types";

const SETTINGS_KEY = "@novelnest_settings";
const LIBRARY_KEY = "@novelnest_library";
const HISTORY_KEY = "@novelnest_history";

export const StorageService = {
  // Settings
  saveSettings: async (settings: AppSettings): Promise<void> => {
    try {
      const jsonValue = JSON.stringify(settings);
      await AsyncStorage.setItem(SETTINGS_KEY, jsonValue);
      console.log("✅ Settings saved");
    } catch (error) {
      console.error("❌ Error saving settings:", error);
      throw error;
    }
  },

  loadSettings: async (): Promise<AppSettings> => {
    try {
      const jsonValue = await AsyncStorage.getItem(SETTINGS_KEY);
      if (jsonValue != null) {
        const parsed = JSON.parse(jsonValue);
        // Deep merge with defaults to ensure all fields exist
        return deepMerge(DEFAULT_SETTINGS, parsed);
      }
      return DEFAULT_SETTINGS;
    } catch (error) {
      console.error("❌ Error loading settings:", error);
      return DEFAULT_SETTINGS;
    }
  },

  clearSettings: async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(SETTINGS_KEY);
      console.log("✅ Settings cleared");
    } catch (error) {
      console.error("❌ Error clearing settings:", error);
      throw error;
    }
  },

  // Library Data
  saveLibrary: async (novels: any[], categories: any[]): Promise<void> => {
    try {
      const data = JSON.stringify({ novels, categories });
      await AsyncStorage.setItem(LIBRARY_KEY, data);
    } catch (error) {
      console.error("❌ Error saving library:", error);
    }
  },

  loadLibrary: async (): Promise<{
    novels: any[];
    categories: any[];
  } | null> => {
    try {
      const jsonValue = await AsyncStorage.getItem(LIBRARY_KEY);
      if (jsonValue) {
        return JSON.parse(jsonValue);
      }
      return null;
    } catch (error) {
      console.error("❌ Error loading library:", error);
      return null;
    }
  },

  // History Data
  saveHistory: async (history: any[]): Promise<void> => {
    try {
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch (error) {
      console.error("❌ Error saving history:", error);
    }
  },

  loadHistory: async (): Promise<any[] | null> => {
    try {
      const jsonValue = await AsyncStorage.getItem(HISTORY_KEY);
      return jsonValue ? JSON.parse(jsonValue) : null;
    } catch (error) {
      console.error("❌ Error loading history:", error);
      return null;
    }
  },

  // Clear All Data
  clearAllData: async (): Promise<void> => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      await AsyncStorage.multiRemove(keys);
      console.log("✅ All data cleared");
    } catch (error) {
      console.error("❌ Error clearing all data:", error);
      throw error;
    }
  },

  // Get storage size info
  getStorageInfo: async (): Promise<{ used: string; free: string }> => {
    // Simplified - Test only in real app we should calculate actual bytes
    return { used: "~156 MB", free: "2.4 GB" };
  },
};

// Deep merge helper
function deepMerge(defaults: any, saved: any): any {
  const result = { ...defaults };

  for (const key in saved) {
    if (
      saved[key] !== null &&
      typeof saved[key] === "object" &&
      !Array.isArray(saved[key])
    ) {
      result[key] = deepMerge(defaults[key] || {}, saved[key]);
    } else {
      result[key] = saved[key];
    }
  }

  return result;
}
