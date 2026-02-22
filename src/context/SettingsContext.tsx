// src/context/SettingsContext.tsx
import React, { createContext, useCallback, useContext, useState } from "react";
import { AppSettings } from "../types";

const defaultSettings: AppSettings = {
  general: {
    startScreen: "library",
    language: "en",
  },
  display: {
    theme: "dark",
  },
  autoDownload: {
    downloadNewChapters: false,
  },
  updates: {
    frequency: "daily",
    onlyUpdateOngoing: false,
  },
  reader: {
    general: {
      keepScreenOn: true,
      volumeButtonsScroll: false,
      swipeToNavigate: true,
      tapToScroll: true,
      autoScroll: false,
    },
    display: {
      fullscreen: true,
      showProgressPercentage: true,
    },
    theme: {
      preset: "default",
      backgroundColor: "#FFFFFF",
      textColor: "#000000",
      textAlign: "justify",
      textSize: 16,
      lineHeight: 1.5,
      padding: 16,
      fontStyle: "System",
    },
  },
  tracking: {
    anilist: false,
    myanimelist: false,
  },
};

interface SettingsContextType {
  settings: AppSettings;
  updateSettings: (path: string, value: any) => void;
  updateGeneralSettings: (
    key: keyof AppSettings["general"],
    value: any,
  ) => void;
  updateDisplaySettings: (
    key: keyof AppSettings["display"],
    value: any,
  ) => void;
  updateAutoDownloadSettings: (
    key: keyof AppSettings["autoDownload"],
    value: any,
  ) => void;
  updateUpdatesSettings: (
    key: keyof AppSettings["updates"],
    value: any,
  ) => void;
  updateReaderSettings: (
    section: keyof AppSettings["reader"],
    key: string,
    value: any,
  ) => void;
  updateTrackingSettings: (
    key: keyof AppSettings["tracking"],
    value: any,
  ) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined,
);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);

  const updateSettings = useCallback((path: string, value: any) => {
    setSettings((prev) => {
      const keys = path.split(".");
      const newSettings = { ...prev };
      let current: any = newSettings;

      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }

      current[keys[keys.length - 1]] = value;
      return newSettings;
    });
  }, []);

  const updateGeneralSettings = useCallback(
    (key: keyof AppSettings["general"], value: any) => {
      setSettings((prev) => ({
        ...prev,
        general: { ...prev.general, [key]: value },
      }));
    },
    [],
  );

  const updateDisplaySettings = useCallback(
    (key: keyof AppSettings["display"], value: any) => {
      setSettings((prev) => ({
        ...prev,
        display: { ...prev.display, [key]: value },
      }));
    },
    [],
  );

  const updateAutoDownloadSettings = useCallback(
    (key: keyof AppSettings["autoDownload"], value: any) => {
      setSettings((prev) => ({
        ...prev,
        autoDownload: { ...prev.autoDownload, [key]: value },
      }));
    },
    [],
  );

  const updateUpdatesSettings = useCallback(
    (key: keyof AppSettings["updates"], value: any) => {
      setSettings((prev) => ({
        ...prev,
        updates: { ...prev.updates, [key]: value },
      }));
    },
    [],
  );

  const updateReaderSettings = useCallback(
    (section: keyof AppSettings["reader"], key: string, value: any) => {
      setSettings((prev) => ({
        ...prev,
        reader: {
          ...prev.reader,
          [section]: { ...prev.reader[section], [key]: value },
        },
      }));
    },
    [],
  );

  const updateTrackingSettings = useCallback(
    (key: keyof AppSettings["tracking"], value: any) => {
      setSettings((prev) => ({
        ...prev,
        tracking: { ...prev.tracking, [key]: value },
      }));
    },
    [],
  );

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateSettings,
        updateGeneralSettings,
        updateDisplaySettings,
        updateAutoDownloadSettings,
        updateUpdatesSettings,
        updateReaderSettings,
        updateTrackingSettings,
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
