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
  // If this novel came from an installed extension/plugin, keep a stable reference
  // so `NovelDetailScreen` can re-fetch latest metadata and chapter list.
  pluginId?: string;
  pluginNovelPath?: string;
}

export interface Chapter {
  id: string;
  novelId: string;
  title: string;
  number: number;
  isRead: boolean;
  isDownloaded: boolean;
  releaseDate: Date;
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
  };
  display: {
    theme: "dark" | "light";
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
  },
  display: {
    theme: "light",
  },
  extensions: {
    repositories: [
      "https://raw.githubusercontent.com/LNReader/lnreader-plugins/plugins/v3.0.0/.dist/plugins.min.json",
    ],
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
  },
  tracking: {
    anilist: false,
    myanimelist: false,
  },
  advanced: {
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  },
};
