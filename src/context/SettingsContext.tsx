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

// Extended settings interface to include all UI states
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

  // General
  updateGeneralSettings: (
    key: keyof AppSettings["general"],
    value: any,
  ) => Promise<void>;
  setStartScreen: (screen: StartScreen) => Promise<void>;
  setDownloadLocation: (path: string | null) => Promise<void>;

  // Display
  updateDisplaySettings: (
    key: keyof AppSettings["display"],
    value: any,
  ) => Promise<void>;
  setTheme: (theme: "dark" | "light") => Promise<void>;

  // Auto-download
  updateAutoDownloadSettings: (
    key: keyof AppSettings["autoDownload"],
    value: any,
  ) => Promise<void>;

  // Updates
  updateUpdatesSettings: (
    key: keyof AppSettings["updates"],
    value: any,
  ) => Promise<void>;

  // Reader
  updateReaderSettings: (
    section: keyof AppSettings["reader"],
    key: string,
    value: any,
  ) => Promise<void>;

  // Tracking
  updateTrackingSettings: (
    key: keyof AppSettings["tracking"],
    value: any,
  ) => Promise<void>;

  // Advanced
  updateAdvancedSettings: (
    key: keyof AppSettings["advanced"],
    value: any,
  ) => Promise<void>;
  setUserAgent: (agent: string) => Promise<void>;

  // Extensions
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

  // UI State (Library view settings)
  setLibraryDisplayMode: (mode: DisplayMode) => Promise<void>;
  setShowDownloadBadges: (show: boolean) => Promise<void>;
  setShowUnreadBadges: (show: boolean) => Promise<void>;
  setShowItemCount: (show: boolean) => Promise<void>;
  setLibrarySortOption: (option: LibrarySortOption) => Promise<void>;
  setLibraryFilterOptions: (options: LibraryFilterOption) => Promise<void>;

  // Reset
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

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const loadedSettings = await StorageService.loadSettings();
      // Merge with extended defaults to ensure UI fields exist
      const merged = { ...EXTENDED_DEFAULTS, ...loadedSettings };
      setSettings(merged);
      console.log("✅ Settings loaded:", merged.ui);
    } catch (error) {
      console.error("❌ Failed to load settings:", error);
    } finally {
      setIsLoading(false);
      setIsReady(true);
    }
  };

  // Save settings helper with debounce
  const saveSettings = async (newSettings: ExtendedSettings) => {
    try {
      await StorageService.saveSettings(newSettings);
      setSettings(newSettings);
    } catch (error) {
      console.error("❌ Failed to save settings:", error);
    }
  };

  // General Settings
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

  // Display Settings
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

  const setTheme = useCallback(
    async (theme: "dark" | "light") => {
      await updateDisplaySettings("theme", theme);
    },
    [updateDisplaySettings],
  );

  // Auto-download
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

  // Updates
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

  // Reader
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

  // Tracking
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

  // Advanced
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

  const setUserAgent = useCallback(
    async (agent: string) => {
      await updateAdvancedSettings("userAgent", agent);
    },
    [updateAdvancedSettings],
  );

  // Extensions
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

  // UI State Settings (Library view)
  const setLibraryDisplayMode = useCallback(
    async (mode: DisplayMode) => {
      const newSettings = {
        ...settings,
        ui: { ...settings.ui, libraryDisplayMode: mode },
      };
      await saveSettings(newSettings);
      console.log("✅ Display mode saved:", mode);
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

  // Reset all settings to defaults
  const resetSettings = useCallback(async () => {
    try {
      await StorageService.clearSettings();
      setSettings(EXTENDED_DEFAULTS);
      console.log("✅ Settings reset to defaults");
    } catch (error) {
      console.error("❌ Failed to reset settings:", error);
      throw error;
    }
  }, []);

  const resetToDefaults = useCallback(async () => {
    await resetSettings();
  }, [resetSettings]);

  if (isLoading) {
    return null; // Or a loading screen
  }

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
