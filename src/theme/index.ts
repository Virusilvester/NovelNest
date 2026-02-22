// src/theme/index.ts
import { COLORS, DARK_COLORS, FONTS, SIZES } from "../constants";

export const lightTheme = {
  colors: COLORS,
  sizes: SIZES,
  fonts: FONTS,
  isDark: false,
};

export const darkTheme = {
  colors: DARK_COLORS,
  sizes: SIZES,
  fonts: FONTS,
  isDark: true,
};

export type Theme = typeof lightTheme;
