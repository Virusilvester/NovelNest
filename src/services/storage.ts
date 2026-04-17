// src/services/storage.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppSettings, DEFAULT_SETTINGS } from "../types";

const SETTINGS_KEY = "@novelnest_settings";
const LEGACY_LNREADER_REPO =
  "https://raw.githubusercontent.com/LNReader/lnreader-plugins/plugins/v3.0.0/.dist/plugins.min.json";

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
        const merged = deepMerge(DEFAULT_SETTINGS, parsed) as AppSettings;

        // Migration: remove the old baked-in LNReader repository URL. Users can add repos manually.
        const existing = Array.isArray(merged.extensions?.repositories)
          ? merged.extensions.repositories
          : [];
        const normalized = existing
          .map((r) => String(r || "").trim())
          .filter(Boolean)
          .filter((r) => r !== LEGACY_LNREADER_REPO);
        const deduped = Array.from(new Set(normalized));

        const changed =
          deduped.length !== existing.length ||
          deduped.some((r, i) => r !== existing[i]);

        if (changed) {
          const migrated: AppSettings = {
            ...merged,
            extensions: {
              ...merged.extensions,
              repositories: deduped,
            },
          };
          await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(migrated));
          return migrated;
        }

        return merged;
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
