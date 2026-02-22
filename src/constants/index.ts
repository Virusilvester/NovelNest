// src/constants/index.ts
import {
  AppSettings,
  LibrarySortOption,
  SourceSortOption,
  StartScreen,
} from "../types";

export const COLORS = {
  primary: "#6200EE",
  primaryDark: "#3700B3",
  accent: "#03DAC6",
  background: "#FAFAFA",
  surface: "#FFFFFF",
  error: "#B00020",
  text: "#212121",
  textSecondary: "#757575",
  border: "#E0E0E0",
  divider: "#EEEEEE",
  success: "#4CAF50",
  warning: "#FF9800",
  info: "#2196F3",
};

export const DARK_COLORS = {
  primary: "#BB86FC",
  primaryDark: "#3700B3",
  accent: "#03DAC6",
  background: "#121212",
  surface: "#1E1E1E",
  error: "#CF6679",
  text: "#FFFFFF",
  textSecondary: "#B0B0B0",
  border: "#2C2C2C",
  divider: "#2C2C2C",
  success: "#4CAF50",
  warning: "#FF9800",
  info: "#2196F3",
};

export const SIZES = {
  padding: 16,
  margin: 8,
  borderRadius: 8,
  iconSize: 24,
  headerHeight: 56,
  tabBarHeight: 64,
};

export const FONTS = {
  regular: "System",
  medium: "System",
  bold: "System",
};

export const LIBRARY_SORT_OPTIONS: {
  label: string;
  value: LibrarySortOption;
}[] = [
  { label: "Alphabetically", value: "alphabetically" },
  { label: "Last read", value: "lastRead" },
  { label: "Unread", value: "unread" },
  { label: "Total chapters", value: "totalChapters" },
  { label: "Latest chapters", value: "latestChapters" },
  { label: "Date added", value: "dateAdded" },
];

export const SOURCE_SORT_OPTIONS: { label: string; value: SourceSortOption }[] =
  [
    { label: "Popular", value: "popular" },
    { label: "Latest", value: "latest" },
    { label: "Top Rated", value: "topRated" },
    { label: "Completed", value: "completed" },
  ];

export const START_SCREENS: { label: string; value: StartScreen }[] = [
  { label: "Library", value: "library" },
  { label: "Updates", value: "updates" },
  { label: "History", value: "history" },
  { label: "Sources", value: "sources" },
];

export const UPDATE_FREQUENCIES: {
  label: string;
  value: AppSettings["updates"]["frequency"];
}[] = [
  { label: "Manual", value: "manual" },
  { label: "Every 12 hours", value: "12hours" },
  { label: "Daily", value: "daily" },
];
