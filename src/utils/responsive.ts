// src/utils/responsive.ts
export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const isLandscape = (width: number, height: number): boolean =>
  width > height;

export const getDrawerWidth = (width: number, height: number): number => {
  const landscape = isLandscape(width, height);
  const raw = landscape ? width * 0.45 : width * 0.8;
  return clamp(Math.round(raw), 260, 420);
};

export const getGridColumns = (width: number): number => {
  if (width >= 900) return 6;
  if (width >= 720) return 5;
  if (width >= 600) return 4;
  if (width >= 420) return 3;
  return 2;
};

export const getGridItemWidth = (
  containerWidth: number,
  columns: number,
  spacing: number,
): number => (containerWidth - spacing * (columns + 1)) / columns;
