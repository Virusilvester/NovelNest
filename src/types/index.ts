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

export interface AppSettings {
  general: {
    startScreen: StartScreen;
    language: string;
  };
  display: {
    theme: "dark" | "light";
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
}
