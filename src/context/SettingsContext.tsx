// src/context/SettingsContext.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { StorageService } from "../services/storage";
import {
  AppSettings,
  DEFAULT_SETTINGS,
  DisplayMode,
  ExtensionRepoPlugin,
  InstalledExtensionPlugin,
  LibraryFilterOption,
  LibrarySortOption,
  StartScreen,
} from "../types";

interface ExtendedSettings extends AppSettings {
  ui: {
    libraryDisplayMode: DisplayMode;
    showDownloadBadges: boolean;
    showUnreadBadges: boolean;
    showItemCount: boolean;
    librarySortOption: LibrarySortOption;
    libraryFilterOptions: LibraryFilterOption;
  };
}

const EXTENDED_DEFAULTS: ExtendedSettings = {
  ...DEFAULT_SETTINGS,
  ui: {
    libraryDisplayMode: "compactGrid",
    showDownloadBadges: true,
    showUnreadBadges: true,
    showItemCount: true,
    librarySortOption: "lastRead",
    libraryFilterOptions: {
      downloaded: false,
      unread: false,
      completed: false,
    },
  },
};

interface SettingsContextType {
  settings: ExtendedSettings;
  isLoading: boolean;
  isReady: boolean;

  updateGeneralSettings: (
    key: keyof AppSettings["general"],
    value: any,
  ) => Promise<void>;
  setStartScreen: (screen: StartScreen) => Promise<void>;
  setDownloadLocation: (path: string | null) => Promise<void>;

  updateDisplaySettings: (
    key: keyof AppSettings["display"],
    value: any,
  ) => Promise<void>;
  setTheme: (theme: "dark" | "light") => Promise<void>;

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
  updateReaderSettingsBatch: (
    updates: {
      section: keyof AppSettings["reader"];
      key: string;
      value: any;
    }[],
  ) => Promise<void>;

  updateTrackingSettings: (
    key: keyof AppSettings["tracking"],
    value: any,
  ) => Promise<void>;

  updateAdvancedSettings: (
    key: keyof AppSettings["advanced"],
    value: any,
  ) => Promise<void>;
  setUserAgent: (agent: string) => Promise<void>;

  addExtensionRepository: (repoUrl: string) => Promise<void>;
  removeExtensionRepository: (repoUrl: string) => Promise<void>;
  installExtensionPlugin: (
    repoUrl: string,
    plugin: ExtensionRepoPlugin,
    localPath?: string,
  ) => Promise<void>;
  uninstallExtensionPlugin: (pluginId: string) => Promise<void>;
  setExtensionPluginEnabled: (
    pluginId: string,
    enabled: boolean,
  ) => Promise<void>;

  setLibraryDisplayMode: (mode: DisplayMode) => Promise<void>;
  setShowDownloadBadges: (show: boolean) => Promise<void>;
  setShowUnreadBadges: (show: boolean) => Promise<void>;
  setShowItemCount: (show: boolean) => Promise<void>;
  setLibrarySortOption: (option: LibrarySortOption) => Promise<void>;
  setLibraryFilterOptions: (options: LibraryFilterOption) => Promise<void>;

  resetSettings: () => Promise<void>;
  resetToDefaults: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined,
);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [settings, setSettings] = useState<ExtendedSettings>(EXTENDED_DEFAULTS);
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    void loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const loadedSettings = await StorageService.loadSettings();
      const merged = deepMerge(EXTENDED_DEFAULTS, loadedSettings);
      setSettings(merged);
    } catch (error) {
      console.error("Failed to load settings:", error);
      setSettings(EXTENDED_DEFAULTS);
    } finally {
      setIsLoading(false);
      setIsReady(true);
    }
  };

  const saveSettings = async (newSettings: ExtendedSettings) => {
    try {
      await StorageService.saveSettings(newSettings);
      setSettings(newSettings);
    } catch (error) {
      console.error("Failed to save settings:", error);
    }
  };

  const updateGeneralSettings = useCallback(
    async (key: keyof AppSettings["general"], value: any) => {
      setSettings((currentSettings) => {
        const newSettings = {
          ...currentSettings,
          general: { ...currentSettings.general, [key]: value },
        };
        void StorageService.saveSettings(newSettings);
        return newSettings;
      });
    },
    [],
  );

  const setStartScreen = useCallback(
    async (screen: StartScreen) => {
      await updateGeneralSettings("startScreen", screen);
    },
    [updateGeneralSettings],
  );

  const setDownloadLocation = useCallback(
    async (path: string | null) => {
      await updateGeneralSettings("downloadLocation", path);
    },
    [updateGeneralSettings],
  );

  const updateDisplaySettings = useCallback(
    async (key: keyof AppSettings["display"], value: any) => {
      setSettings((currentSettings) => {
        const newSettings = {
          ...currentSettings,
          display: { ...currentSettings.display, [key]: value },
        };
        void StorageService.saveSettings(newSettings);
        return newSettings;
      });
    },
    [],
  );

  const setTheme = useCallback(
    async (theme: "dark" | "light") => {
      await updateDisplaySettings("theme", theme);
    },
    [updateDisplaySettings],
  );

  const updateAutoDownloadSettings = useCallback(
    async (key: keyof AppSettings["autoDownload"], value: any) => {
      setSettings((currentSettings) => {
        const newSettings = {
          ...currentSettings,
          autoDownload: { ...currentSettings.autoDownload, [key]: value },
        };
        void StorageService.saveSettings(newSettings);
        return newSettings;
      });
    },
    [],
  );

  const updateUpdatesSettings = useCallback(
    async (key: keyof AppSettings["updates"], value: any) => {
      setSettings((currentSettings) => {
        const newSettings = {
          ...currentSettings,
          updates: { ...currentSettings.updates, [key]: value },
        };
        void StorageService.saveSettings(newSettings);
        return newSettings;
      });
    },
    [],
  );

  const updateReaderSettings = useCallback(
    async (section: keyof AppSettings["reader"], key: string, value: any) => {
      setSettings((currentSettings) => {
        const newSettings = {
          ...currentSettings,
          reader: {
            ...currentSettings.reader,
            [section]: {
              ...(currentSettings.reader as any)[section],
              [key]: value,
            },
          },
        };
        // Save asynchronously without blocking the state update
        void StorageService.saveSettings(newSettings);
        return newSettings;
      });
    },
    [],
  );

  const updateReaderSettingsBatch = useCallback(
    async (
      updates: {
        section: keyof AppSettings["reader"];
        key: string;
        value: any;
      }[],
    ) => {
      setSettings((currentSettings) => {
        let newReaderSettings = { ...currentSettings.reader };

        for (const update of updates) {
          newReaderSettings = {
            ...newReaderSettings,
            [update.section]: {
              ...(newReaderSettings as any)[update.section],
              [update.key]: update.value,
            },
          };
        }

        const newSettings = {
          ...currentSettings,
          reader: newReaderSettings,
        };

        // Save asynchronously without blocking the state update
        void StorageService.saveSettings(newSettings);
        return newSettings;
      });
    },
    [],
  );

  const updateTrackingSettings = useCallback(
    async (key: keyof AppSettings["tracking"], value: any) => {
      setSettings((currentSettings) => {
        const newSettings = {
          ...currentSettings,
          tracking: { ...currentSettings.tracking, [key]: value },
        };
        void StorageService.saveSettings(newSettings);
        return newSettings;
      });
    },
    [],
  );

  const updateAdvancedSettings = useCallback(
    async (key: keyof AppSettings["advanced"], value: any) => {
      setSettings((currentSettings) => {
        const newSettings = {
          ...currentSettings,
          advanced: { ...currentSettings.advanced, [key]: value },
        };
        void StorageService.saveSettings(newSettings);
        return newSettings;
      });
    },
    [],
  );

  const setUserAgent = useCallback(
    async (agent: string) => {
      await updateAdvancedSettings("userAgent", agent);
    },
    [updateAdvancedSettings],
  );

  const addExtensionRepository = useCallback(
    async (repoUrl: string) => {
      const normalized = repoUrl.trim();
      if (!normalized) return;
      const next = Array.from(
        new Set([...(settings.extensions.repositories || []), normalized]),
      );
      const newSettings = {
        ...settings,
        extensions: { ...settings.extensions, repositories: next },
      };
      await saveSettings(newSettings);
    },
    [settings],
  );

  const removeExtensionRepository = useCallback(
    async (repoUrl: string) => {
      const normalized = repoUrl.trim();
      const next = (settings.extensions.repositories || []).filter(
        (r) => r !== normalized,
      );
      const newSettings = {
        ...settings,
        extensions: { ...settings.extensions, repositories: next },
      };
      await saveSettings(newSettings);
    },
    [settings],
  );

  const installExtensionPlugin = useCallback(
    async (
      repoUrl: string,
      plugin: ExtensionRepoPlugin,
      localPath?: string,
    ) => {
      const installed: InstalledExtensionPlugin = {
        ...plugin,
        repoUrl,
        installedAt: new Date().toISOString(),
        enabled: true,
        localPath,
      };
      const newSettings = {
        ...settings,
        extensions: {
          ...settings.extensions,
          installedPlugins: {
            ...settings.extensions.installedPlugins,
            [plugin.id]: installed,
          },
        },
      };
      await saveSettings(newSettings);
    },
    [settings],
  );

  const uninstallExtensionPlugin = useCallback(
    async (pluginId: string) => {
      const { [pluginId]: _removed, ...rest } =
        settings.extensions.installedPlugins || {};
      const newSettings = {
        ...settings,
        extensions: { ...settings.extensions, installedPlugins: rest },
      };
      await saveSettings(newSettings);
    },
    [settings],
  );

  const setExtensionPluginEnabled = useCallback(
    async (pluginId: string, enabled: boolean) => {
      const existing = settings.extensions.installedPlugins?.[pluginId];
      if (!existing) return;
      const newSettings = {
        ...settings,
        extensions: {
          ...settings.extensions,
          installedPlugins: {
            ...settings.extensions.installedPlugins,
            [pluginId]: { ...existing, enabled },
          },
        },
      };
      await saveSettings(newSettings);
    },
    [settings],
  );

  const setLibraryDisplayMode = useCallback(
    async (mode: DisplayMode) => {
      const newSettings = {
        ...settings,
        ui: { ...settings.ui, libraryDisplayMode: mode },
      };
      await saveSettings(newSettings);
    },
    [settings],
  );

  const setShowDownloadBadges = useCallback(
    async (show: boolean) => {
      const newSettings = {
        ...settings,
        ui: { ...settings.ui, showDownloadBadges: show },
      };
      await saveSettings(newSettings);
    },
    [settings],
  );

  const setShowUnreadBadges = useCallback(
    async (show: boolean) => {
      const newSettings = {
        ...settings,
        ui: { ...settings.ui, showUnreadBadges: show },
      };
      await saveSettings(newSettings);
    },
    [settings],
  );

  const setShowItemCount = useCallback(
    async (show: boolean) => {
      const newSettings = {
        ...settings,
        ui: { ...settings.ui, showItemCount: show },
      };
      await saveSettings(newSettings);
    },
    [settings],
  );

  const setLibrarySortOption = useCallback(
    async (option: LibrarySortOption) => {
      const newSettings = {
        ...settings,
        ui: { ...settings.ui, librarySortOption: option },
      };
      await saveSettings(newSettings);
    },
    [settings],
  );

  const setLibraryFilterOptions = useCallback(
    async (options: LibraryFilterOption) => {
      const newSettings = {
        ...settings,
        ui: { ...settings.ui, libraryFilterOptions: options },
      };
      await saveSettings(newSettings);
    },
    [settings],
  );

  const resetSettings = useCallback(async () => {
    await StorageService.clearSettings();
    setSettings(EXTENDED_DEFAULTS);
  }, []);

  const resetToDefaults = useCallback(async () => {
    await resetSettings();
  }, [resetSettings]);

  if (isLoading) return null;

  return (
    <SettingsContext.Provider
      value={{
        settings,
        isLoading,
        isReady,
        updateGeneralSettings,
        setStartScreen,
        setDownloadLocation,
        updateDisplaySettings,
        setTheme,
        updateAutoDownloadSettings,
        updateUpdatesSettings,
        updateReaderSettings,
        updateReaderSettingsBatch,
        updateTrackingSettings,
        updateAdvancedSettings,
        setUserAgent,
        addExtensionRepository,
        removeExtensionRepository,
        installExtensionPlugin,
        uninstallExtensionPlugin,
        setExtensionPluginEnabled,
        setLibraryDisplayMode,
        setShowDownloadBadges,
        setShowUnreadBadges,
        setShowItemCount,
        setLibrarySortOption,
        setLibraryFilterOptions,
        resetSettings,
        resetToDefaults,
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

function deepMerge<T>(defaults: T, saved: any): T {
  if (!saved || typeof saved !== "object") return defaults;

  const result: any = Array.isArray(defaults)
    ? [...(defaults as any)]
    : { ...(defaults as any) };
  for (const key of Object.keys(saved)) {
    const savedValue = saved[key];
    const defaultValue = (defaults as any)?.[key];

    if (
      savedValue !== null &&
      typeof savedValue === "object" &&
      !Array.isArray(savedValue) &&
      defaultValue !== null &&
      typeof defaultValue === "object" &&
      !Array.isArray(defaultValue)
    ) {
      result[key] = deepMerge(defaultValue, savedValue);
    } else {
      result[key] = savedValue;
    }
  }

  return result as T;
}
