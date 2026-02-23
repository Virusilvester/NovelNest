// src/context/SettingsContext.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { StorageService } from "../services/storage";
import { AppSettings, DEFAULT_SETTINGS } from "../types";

interface SettingsContextType {
  settings: AppSettings;
  isLoading: boolean;
  updateSettings: (path: string, value: any) => Promise<void>;
  updateGeneralSettings: (
    key: keyof AppSettings["general"],
    value: any,
  ) => Promise<void>;
  updateDisplaySettings: (
    key: keyof AppSettings["display"],
    value: any,
  ) => Promise<void>;
  updateAutoDownloadSettings: (
    key: keyof AppSettings["autoDownload"],
    value: any,
  ) => Promise<void>;
  updateUpdatesSettings: (
    key: keyof AppSettings["updates"],
    value: any,
  ) => Promise<void>;
  updateReaderSettings: (
    section: keyof AppSettings["reader"],
    key: string,
    value: any,
  ) => Promise<void>;
  updateTrackingSettings: (
    key: keyof AppSettings["tracking"],
    value: any,
  ) => Promise<void>;
  updateAdvancedSettings: (
    key: keyof AppSettings["advanced"],
    value: any,
  ) => Promise<void>;
  resetSettings: () => Promise<void>;
  setDownloadLocation: (path: string | null) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined,
);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const loadedSettings = await StorageService.loadSettings();
      setSettings(loadedSettings);
    } catch (error) {
      console.error("Failed to load settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Save settings helper
  const saveSettings = async (newSettings: AppSettings) => {
    try {
      await StorageService.saveSettings(newSettings);
      setSettings(newSettings);
    } catch (error) {
      console.error("Failed to save settings:", error);
    }
  };

  const updateSettings = useCallback(
    async (path: string, value: any) => {
      const keys = path.split(".");
      const newSettings = { ...settings };
      let current: any = newSettings;

      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }

      current[keys[keys.length - 1]] = value;
      await saveSettings(newSettings);
    },
    [settings],
  );

  const updateGeneralSettings = useCallback(
    async (key: keyof AppSettings["general"], value: any) => {
      const newSettings = {
        ...settings,
        general: { ...settings.general, [key]: value },
      };
      await saveSettings(newSettings);
    },
    [settings],
  );

  const updateDisplaySettings = useCallback(
    async (key: keyof AppSettings["display"], value: any) => {
      const newSettings = {
        ...settings,
        display: { ...settings.display, [key]: value },
      };
      await saveSettings(newSettings);
    },
    [settings],
  );

  const updateAutoDownloadSettings = useCallback(
    async (key: keyof AppSettings["autoDownload"], value: any) => {
      const newSettings = {
        ...settings,
        autoDownload: { ...settings.autoDownload, [key]: value },
      };
      await saveSettings(newSettings);
    },
    [settings],
  );

  const updateUpdatesSettings = useCallback(
    async (key: keyof AppSettings["updates"], value: any) => {
      const newSettings = {
        ...settings,
        updates: { ...settings.updates, [key]: value },
      };
      await saveSettings(newSettings);
    },
    [settings],
  );

  const updateReaderSettings = useCallback(
    async (section: keyof AppSettings["reader"], key: string, value: any) => {
      const newSettings = {
        ...settings,
        reader: {
          ...settings.reader,
          [section]: { ...settings.reader[section], [key]: value },
        },
      };
      await saveSettings(newSettings);
    },
    [settings],
  );

  const updateTrackingSettings = useCallback(
    async (key: keyof AppSettings["tracking"], value: any) => {
      const newSettings = {
        ...settings,
        tracking: { ...settings.tracking, [key]: value },
      };
      await saveSettings(newSettings);
    },
    [settings],
  );

  const updateAdvancedSettings = useCallback(
    async (key: keyof AppSettings["advanced"], value: any) => {
      const newSettings = {
        ...settings,
        advanced: { ...settings.advanced, [key]: value },
      };
      await saveSettings(newSettings);
    },
    [settings],
  );

  const resetSettings = useCallback(async () => {
    await StorageService.clearSettings();
    setSettings(DEFAULT_SETTINGS);
  }, []);

  const setDownloadLocation = useCallback(
    async (path: string | null) => {
      await updateGeneralSettings("downloadLocation", path);
    },
    [updateGeneralSettings],
  );

  if (isLoading) {
    // You might want to show a loading screen here
    return null;
  }

  return (
    <SettingsContext.Provider
      value={{
        settings,
        isLoading,
        updateSettings,
        updateGeneralSettings,
        updateDisplaySettings,
        updateAutoDownloadSettings,
        updateUpdatesSettings,
        updateReaderSettings,
        updateTrackingSettings,
        updateAdvancedSettings,
        resetSettings,
        setDownloadLocation,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context)
    throw new Error("useSettings must be used within SettingsProvider");
  return context;
};
