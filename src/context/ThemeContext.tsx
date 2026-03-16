// src/context/ThemeContext.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useColorScheme } from "react-native";
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
  const settingsContext = useSettings();
  const systemScheme = useColorScheme();

  const [isDark, setIsDark] = useState(() => {
    // Initialize from settings if available, otherwise default to false
    const pref = settingsContext.settings.display.theme;
    if (pref === "system") return systemScheme === "dark";
    return pref === "dark";
  });

  // Sync with settings when they change
  useEffect(() => {
    const pref = settingsContext.settings.display.theme;
    if (pref === "system") {
      setIsDark(systemScheme === "dark");
      return;
    }
    setIsDark(pref === "dark");
  }, [settingsContext.settings.display.theme, systemScheme]);

  const toggleTheme = useCallback(() => {
    const newValue = !isDark;
    setIsDark(newValue);
    settingsContext.updateDisplaySettings("theme", newValue ? "dark" : "light");
  }, [isDark, settingsContext]);

  const setTheme = useCallback(
    (dark: boolean) => {
      setIsDark(dark);
      settingsContext.updateDisplaySettings("theme", dark ? "dark" : "light");
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
