// src/types/index.ts
export interface Novel {
  id: string;
  title: string;
  author: string;
  coverUrl: string;
  status: "ongoing" | "completed";
  source: string;
  summary: string;
  genres: string[];
  totalChapters: number;
  unreadChapters: number;
  lastReadChapter?: number;
  lastReadDate?: Date;
  isDownloaded: boolean;
  isInLibrary: boolean;
  categoryId: string;
  // Auto-download setting for this novel
  autoDownload?: boolean;
  // If this novel came from an installed extension/plugin, keep a stable reference
  // so `NovelDetailScreen` can re-fetch latest metadata and chapter list.
  pluginId?: string;
  pluginNovelPath?: string;
  // Cached plugin metadata + chapters for offline/fast reload (included in DB backups).
  pluginCache?: CachedPluginNovelDetail;
  // Per-chapter state overrides (only for chapters the user interacted with).
  // If a chapter path is present, its value overrides the inferred read/unread state.
  chapterReadOverrides?: Record<string, boolean>;
  // Per-chapter scroll progress (0-100) keyed by chapter path.
  // Used to resume chapters at the exact position the user left off.
  chapterScrollProgress?: Record<string, number>;
  // Downloaded chapter files (keyed by chapter path).
  chapterDownloaded?: Record<string, boolean>;
  trackingLinks?: Record<string, TrackerLink>;
}

export type TrackerId = "anilist" | "myanimelist";

export type UserListStatus =
  | "CURRENT"
  | "COMPLETED"
  | "PAUSED"
  | "DROPPED"
  | "PLANNING"
  | "REPEATING";

export type TrackerLink = {
  trackerId: TrackerId;
  remoteId: string;
  title: string;
  coverImage?: string;
};

export type CachedPluginChapter = {
  name: string;
  path: string;
  releaseTime?: string | null;
  chapterNumber?: number;
};

export type CachedPluginNovelDetail = {
  signature: string;
  cachedAt: number;
  // Keep this small + JSON-serializable; screens can reconstruct chapters from `chapters`.
  detail: {
    name?: string;
    author?: string;
    cover?: string;
    summary?: string;
    genres?: string[];
    status?: string;
    totalChapters?: number;
    url?: string;
    path?: string;
  } | null;
  chapters: CachedPluginChapter[];
  chaptersPage: number;
  chaptersHasMore: boolean;
};

export interface Chapter {
  id: string;
  novelId: string;
  title: string;
  number: number;
  isRead: boolean;
  isDownloaded: boolean;
  releaseDate: Date;
  // Reader-only UI state: last known in-chapter scroll progress (0-100).
  // Used to resume at the exact place the user left off.
  scrollProgress?: number;
  content?: string;
}

export interface Source {
  id: string;
  name: string;
  iconUrl: string;
  isEnabled: boolean;
  supportsSearch: boolean;
  supportsFilters: boolean;
}

export interface Category {
  id: string;
  name: string;
  order: number;
}

export interface HistoryEntry {
  id: string;
  novel: Novel;
  lastReadChapter: Chapter;
  progress: number; // 0-100 percentage
  totalChaptersRead: number;
  lastReadDate: Date;
  timeSpentReading: number; // in minutes
}

export interface ReadingSession {
  id: string;
  novelId: string;
  chapterId: string;
  startTime: Date;
  endTime?: Date;
  pagesRead: number;
}

export type LibrarySortOption =
  | "alphabetically"
  | "lastRead"
  | "unread"
  | "totalChapters"
  | "latestChapters"
  | "dateAdded";

export type LibraryFilterOption = {
  downloaded: boolean;
  unread: boolean;
  completed: boolean;
};

export type DisplayMode = "compactGrid" | "list";

export type SourceSortOption = "popular" | "latest" | "topRated" | "completed";

export type StartScreen = "library" | "updates" | "history" | "sources";

export interface ExtensionRepoPlugin {
  id: string;
  name: string;
  version: string;
  lang: string;
  site: string;
  url: string;
  iconUrl: string;
}

export interface InstalledExtensionPlugin extends ExtensionRepoPlugin {
  repoUrl: string;
  installedAt: string;
  enabled: boolean;
  localPath?: string;
}

export interface AppSettings {
  general: {
    startScreen: StartScreen;
    language: string;
    downloadLocation: string | null;
    confirmExitOnBack: boolean;
  };
  display: {
    theme: "dark" | "light" | "system";
  };
  extensions: {
    repositories: string[];
    installedPlugins: Record<string, InstalledExtensionPlugin>;
  };
  autoDownload: {
    downloadNewChapters: boolean;
  };
  updates: {
    frequency: "manual" | "12hours" | "daily";
    onlyUpdateOngoing: boolean;
  };
  reader: {
    general: {
      keepScreenOn: boolean;
      volumeButtonsScroll: boolean;
      swipeToNavigate: boolean;
      tapToScroll: boolean;
      autoScroll: boolean;
    };
    display: {
      fullscreen: boolean;
      showProgressPercentage: boolean;
    };
    theme: {
      preset: string;
      backgroundColor: string;
      textColor: string;
      textAlign: "left" | "center" | "justify";
      textSize: number;
      lineHeight: number;
      padding: number;
      fontStyle: string;
    };
    tts: {
      enabled: boolean;
      voice: string | null;
      language: string | null;
      rate: number;
      pitch: number;
      autoAdvanceChapters: boolean;
    };
  };
  tracking: {
    anilist: boolean;
    myanimelist: boolean;
  };
  advanced: {
    userAgent: string;
  };
}

export const DEFAULT_SETTINGS: AppSettings = {
  general: {
    startScreen: "library",
    language: "en",
    downloadLocation: null,
    confirmExitOnBack: false,
  },
  display: {
    theme: "light",
  },
  extensions: {
    repositories: [],
    installedPlugins: {},
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
    tts: {
      enabled: true,
      voice: null,
      language: null,
      rate: 1.0,
      pitch: 1.0,
      autoAdvanceChapters: false,
    },
  },
  tracking: {
    anilist: false,
    myanimelist: false,
  },
  advanced: {
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  },
};
