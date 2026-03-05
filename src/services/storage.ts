// src/services/storage.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppSettings, DEFAULT_SETTINGS } from "../types";

const SETTINGS_KEY = "@novelnest_settings";

export const StorageService = {
  saveSettings: async (settings: AppSettings): Promise<void> => {
    const jsonValue = JSON.stringify(settings);
    await AsyncStorage.setItem(SETTINGS_KEY, jsonValue);
  },

  loadSettings: async (): Promise<AppSettings> => {
    try {
      const jsonValue = await AsyncStorage.getItem(SETTINGS_KEY);
      if (jsonValue != null) {
        const parsed = JSON.parse(jsonValue);
        return deepMerge(DEFAULT_SETTINGS, parsed);
      }
      return DEFAULT_SETTINGS;
    } catch (error) {
      console.error("Error loading settings:", error);
      return DEFAULT_SETTINGS;
    }
  },

  clearSettings: async (): Promise<void> => {
    await AsyncStorage.removeItem(SETTINGS_KEY);
  },
};

function deepMerge(defaults: any, saved: any): any {
  if (!saved || typeof saved !== "object") return defaults;

  const result = { ...defaults };
  for (const key in saved) {
    if (
      saved[key] !== null &&
      typeof saved[key] === "object" &&
      !Array.isArray(saved[key]) &&
      defaults[key] !== null &&
      typeof defaults[key] === "object" &&
      !Array.isArray(defaults[key])
    ) {
      result[key] = deepMerge(defaults[key] || {}, saved[key]);
    } else {
      result[key] = saved[key];
    }
  }

  return result;
}

