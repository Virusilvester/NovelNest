// src/utils/chapterState.ts
export type ChapterListOrder = "asc" | "desc";

type ChapterLike = { path: string; chapterNumber?: number | null };

const clampInt = (value: number, min: number, max: number) => {
  const v = Number.isFinite(value) ? Math.floor(value) : 0;
  return Math.max(min, Math.min(max, v));
};

const hasOwn = (obj: Record<string, any> | undefined, key: string) => {
  if (!obj) return false;
  return Object.prototype.hasOwnProperty.call(obj, key);
};

export const detectChapterListOrder = (
  chapters: ChapterLike[],
): ChapterListOrder => {
  const first = chapters[0]?.chapterNumber;
  const last = chapters[chapters.length - 1]?.chapterNumber;
  if (typeof first === "number" && typeof last === "number" && first !== last) {
    return first > last ? "desc" : "asc";
  }
  return "desc";
};

export const getBaseReadForIndex = (opts: {
  index: number;
  total: number;
  baseReadCount: number;
  order: ChapterListOrder;
}): boolean => {
  const total = Math.max(0, opts.total);
  const baseReadCount = clampInt(opts.baseReadCount, 0, total);
  const index = clampInt(opts.index, 0, Math.max(0, total - 1));

  if (total === 0) return false;
  if (baseReadCount === 0) return false;

  if (opts.order === "asc") {
    return index < baseReadCount;
  }
  // desc: newest first, so read chapters are at the bottom of the list
  return index >= total - baseReadCount;
};

export const getEffectiveReadForChapter = (opts: {
  chapterPath: string;
  index: number;
  total: number;
  baseReadCount: number;
  order: ChapterListOrder;
  readOverrides?: Record<string, boolean>;
}): boolean => {
  if (hasOwn(opts.readOverrides, opts.chapterPath)) {
    return Boolean(opts.readOverrides?.[opts.chapterPath]);
  }
  return getBaseReadForIndex(opts);
};

export const computeTotalEffectiveReadCount = (opts: {
  total: number;
  baseReadCount: number;
  order: ChapterListOrder;
  chapters: ChapterLike[];
  readOverrides?: Record<string, boolean>;
}): number => {
  const total = Math.max(0, opts.total);
  if (total === 0) return 0;

  let readCount = clampInt(opts.baseReadCount, 0, total);
  const overrides = opts.readOverrides;
  if (!overrides) return readCount;
  const overrideEntries = Object.entries(overrides);
  if (overrideEntries.length === 0) return readCount;

  const indexByPath = new Map<string, number>();
  opts.chapters.forEach((c, i) => {
    if (c?.path) indexByPath.set(String(c.path), i);
  });

  for (const [path, overrideRead] of overrideEntries) {
    const index = indexByPath.get(path);
    if (index == null) continue;

    const baseRead = getBaseReadForIndex({
      index,
      total,
      baseReadCount: opts.baseReadCount,
      order: opts.order,
    });
    const override = Boolean(overrideRead);
    if (override === baseRead) continue;

    if (baseRead && !override) readCount -= 1;
    if (!baseRead && override) readCount += 1;
  }

  return clampInt(readCount, 0, total);
};

export const updateReadOverridesForSelection = (opts: {
  total: number;
  baseReadCount: number;
  order: ChapterListOrder;
  chapters: ChapterLike[];
  selectedPaths: Set<string>;
  readOverrides?: Record<string, boolean>;
  markAs: "read" | "unread";
}): Record<string, boolean> | undefined => {
  if (opts.selectedPaths.size === 0) return opts.readOverrides;

  const next: Record<string, boolean> = { ...(opts.readOverrides || {}) };
  const indexByPath = new Map<string, number>();
  opts.chapters.forEach((c, i) => {
    if (c?.path) indexByPath.set(String(c.path), i);
  });

  const desired = opts.markAs === "read";

  for (const path of opts.selectedPaths) {
    const index = indexByPath.get(path);
    if (index == null) continue;
    const baseRead = getBaseReadForIndex({
      index,
      total: opts.total,
      baseReadCount: opts.baseReadCount,
      order: opts.order,
    });

    if (desired === baseRead) {
      delete next[path];
    } else {
      next[path] = desired;
    }
  }

  const keys = Object.keys(next);
  return keys.length ? next : undefined;
};

export const pickResumeChapter = <T extends { path: string }>(opts: {
  chapters: T[];
  order: ChapterListOrder;
  baseReadCount: number;
  readOverrides?: Record<string, boolean>;
  lastReadPath?: string | null;
}): { chapter: T; index: number } | null => {
  const total = Math.max(0, opts.chapters.length);
  if (total === 0) return null;

  const safeBase = clampInt(opts.baseReadCount, 0, total);

  const lastReadPath = opts.lastReadPath ? String(opts.lastReadPath) : "";
  if (lastReadPath) {
    const idx = opts.chapters.findIndex(
      (c) => String(c?.path) === lastReadPath,
    );
    if (idx >= 0) return { chapter: opts.chapters[idx], index: idx };
  }

  const indices =
    opts.order === "asc"
      ? Array.from({ length: total }, (_, i) => i)
      : Array.from({ length: total }, (_, i) => total - 1 - i);

  for (const index of indices) {
    const chapter = opts.chapters[index];
    if (!chapter?.path) continue;
    const isRead = getEffectiveReadForChapter({
      chapterPath: String(chapter.path),
      index,
      total,
      baseReadCount: safeBase,
      order: opts.order,
      readOverrides: opts.readOverrides,
    });
    if (!isRead) return { chapter, index };
  }

  // Completed: open the last chapter in reading order.
  const completedIndex = opts.order === "asc" ? total - 1 : 0;
  return { chapter: opts.chapters[completedIndex], index: completedIndex };
};
