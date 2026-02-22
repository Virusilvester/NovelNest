// src/context/ThemeContext.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { darkTheme, lightTheme, Theme } from "../theme";
import { useSettings } from "./SettingsContext";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (isDark: boolean) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // Try to get settings, but don't fail if SettingsProvider is not available
  let settingsContext;
  try {
    settingsContext = useSettings();
  } catch (e) {
    settingsContext = null;
  }

  const [isDark, setIsDark] = useState(() => {
    // Initialize from settings if available, otherwise default to false
    return settingsContext?.settings?.display?.theme === "dark" || false;
  });

  // Sync with settings when they change
  useEffect(() => {
    if (settingsContext?.settings?.display?.theme) {
      setIsDark(settingsContext.settings.display.theme === "dark");
    }
  }, [settingsContext?.settings?.display?.theme]);

  const toggleTheme = useCallback(() => {
    const newValue = !isDark;
    setIsDark(newValue);
    // Update settings if available
    if (settingsContext?.updateDisplaySettings) {
      settingsContext.updateDisplaySettings(
        "theme",
        newValue ? "dark" : "light",
      );
    }
  }, [isDark, settingsContext]);

  const setTheme = useCallback(
    (dark: boolean) => {
      setIsDark(dark);
      if (settingsContext?.updateDisplaySettings) {
        settingsContext.updateDisplaySettings("theme", dark ? "dark" : "light");
      }
    },
    [settingsContext],
  );

  const theme = isDark ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
};
