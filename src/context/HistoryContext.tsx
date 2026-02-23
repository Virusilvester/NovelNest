// src/context/HistoryContext.tsx
import React, { createContext, useCallback, useContext, useState } from "react";
import { HistoryEntry } from "../types";

// Mock History Data
const mockHistoryEntries: HistoryEntry[] = [
  {
    id: "1",
    novel: {
      id: "1",
      title: "The Beginning After The End",
      author: "TurtleMe",
      coverUrl:
        "https://cdn.novelupdates.com/images/2021/06/The-Beginning-After-The-End-Kindle.jpg",
      status: "ongoing",
      source: "Novel Updates",
      summary: "King Grey has unrivaled strength...",
      genres: ["Action", "Adventure", "Fantasy"],
      totalChapters: 420,
      unreadChapters: 15,
      lastReadChapter: 405,
      lastReadDate: new Date(Date.now() - 86400000 * 2),
      isDownloaded: true,
      isInLibrary: true,
      categoryId: "reading",
    },
    lastReadChapter: {
      id: "405",
      novelId: "1",
      title: "Chapter 405: The Return",
      number: 405,
      isRead: true,
      isDownloaded: true,
      releaseDate: new Date(),
    },
    progress: 96.4, // 405/420
    totalChaptersRead: 405,
    lastReadDate: new Date(Date.now() - 86400000 * 2), // 2 days ago
    timeSpentReading: 1240, // minutes
  },
  {
    id: "2",
    novel: {
      id: "2",
      title: "Omniscient Reader's Viewpoint",
      author: "Sing-Shong",
      coverUrl:
        "https://cdn.novelupdates.com/images/2020/03/Omniscient-Readers-Viewpoint.jpg",
      status: "completed",
      source: "Novel Updates",
      summary: "Only I know the end of this world...",
      genres: ["Action", "Adventure", "Fantasy"],
      totalChapters: 551,
      unreadChapters: 0,
      lastReadChapter: 551,
      lastReadDate: new Date(Date.now() - 86400000 * 5),
      isDownloaded: true,
      isInLibrary: true,
      categoryId: "completed",
    },
    lastReadChapter: {
      id: "551",
      novelId: "2",
      title: "Epilogue 5: The Eternity",
      number: 551,
      isRead: true,
      isDownloaded: true,
      releaseDate: new Date(),
    },
    progress: 100,
    totalChaptersRead: 551,
    lastReadDate: new Date(Date.now() - 86400000 * 5), // 5 days ago
    timeSpentReading: 2100,
  },
  {
    id: "3",
    novel: {
      id: "7",
      title: "Shadow Slave",
      author: "Guiltythree",
      coverUrl: "https://cdn.novelupdates.com/images/2021/11/Shadow-Slave.jpg",
      status: "ongoing",
      source: "Novel Updates",
      summary: "Growing up in poverty, Sunny never expected...",
      genres: ["Action", "Adventure", "Fantasy"],
      totalChapters: 1200,
      unreadChapters: 45,
      lastReadChapter: 1155,
      lastReadDate: new Date(Date.now() - 86400000 * 0.5),
      isDownloaded: true,
      isInLibrary: true,
      categoryId: "reading",
    },
    lastReadChapter: {
      id: "1155",
      novelId: "7",
      title: "Chapter 1155: The Nightmare",
      number: 1155,
      isRead: true,
      isDownloaded: true,
      releaseDate: new Date(),
    },
    progress: 96.3,
    totalChaptersRead: 1155,
    lastReadDate: new Date(Date.now() - 86400000 * 0.5), // 12 hours ago
    timeSpentReading: 3400,
  },
  {
    id: "4",
    novel: {
      id: "11",
      title: "Overgeared",
      author: "Park Saenal",
      coverUrl: "https://cdn.novelupdates.com/images/2017/03/Overgeared.jpg",
      status: "ongoing",
      source: "Novel Updates",
      summary: "As Shin Youngwoo has had an unfortunate life...",
      genres: ["Action", "Adventure", "Game"],
      totalChapters: 1800,
      unreadChapters: 80,
      lastReadChapter: 1720,
      lastReadDate: new Date(Date.now() - 86400000 * 3),
      isDownloaded: true,
      isInLibrary: true,
      categoryId: "reading",
    },
    lastReadChapter: {
      id: "1720",
      novelId: "11",
      title: "Chapter 1720: The Grid",
      number: 1720,
      isRead: true,
      isDownloaded: false,
      releaseDate: new Date(),
    },
    progress: 95.6,
    totalChaptersRead: 1720,
    lastReadDate: new Date(Date.now() - 86400000 * 3), // 3 days ago
    timeSpentReading: 2800,
  },
  {
    id: "5",
    novel: {
      id: "6",
      title: "Lord of the Mysteries",
      author: "Cuttlefish That Loves Diving",
      coverUrl:
        "https://cdn.novelupdates.com/images/2019/05/Lord-of-the-Mysteries.jpg",
      status: "completed",
      source: "Novel Updates",
      summary: "In the waves of steam and machinery...",
      genres: ["Action", "Adventure", "Mystery"],
      totalChapters: 1394,
      unreadChapters: 0,
      lastReadChapter: 1394,
      lastReadDate: new Date(Date.now() - 86400000 * 10),
      isDownloaded: true,
      isInLibrary: true,
      categoryId: "favorites",
    },
    lastReadChapter: {
      id: "1394",
      novelId: "6",
      title: "Chapter 1394: The End",
      number: 1394,
      isRead: true,
      isDownloaded: true,
      releaseDate: new Date(),
    },
    progress: 100,
    totalChaptersRead: 1394,
    lastReadDate: new Date(Date.now() - 86400000 * 10), // 10 days ago
    timeSpentReading: 4500,
  },
  {
    id: "6",
    novel: {
      id: "10",
      title: "A Will Eternal",
      author: "Er Gen",
      coverUrl:
        "https://cdn.novelupdates.com/images/2016/05/A-Will-Eternal.jpg",
      status: "completed",
      source: "Novel Updates",
      summary: "One will to create oceans...",
      genres: ["Action", "Adventure", "Comedy"],
      totalChapters: 1314,
      unreadChapters: 0,
      lastReadChapter: 1314,
      lastReadDate: new Date(Date.now() - 86400000 * 15),
      isDownloaded: true,
      isInLibrary: true,
      categoryId: "favorites",
    },
    lastReadChapter: {
      id: "1314",
      novelId: "10",
      title: "Chapter 1314: Eternal Will",
      number: 1314,
      isRead: true,
      isDownloaded: true,
      releaseDate: new Date(),
    },
    progress: 100,
    totalChaptersRead: 1314,
    lastReadDate: new Date(Date.now() - 86400000 * 15), // 15 days ago
    timeSpentReading: 3200,
  },
  {
    id: "7",
    novel: {
      id: "3",
      title: "Solo Leveling",
      author: "Chugong",
      coverUrl: "https://cdn.novelupdates.com/images/2019/12/solo-leveling.jpg",
      status: "completed",
      source: "Novel Updates",
      summary: '10 years ago, after "the Gate" that connected...',
      genres: ["Action", "Adventure", "Fantasy"],
      totalChapters: 270,
      unreadChapters: 50,
      lastReadChapter: 220,
      lastReadDate: new Date(Date.now() - 86400000 * 30),
      isDownloaded: false,
      isInLibrary: true,
      categoryId: "on_hold",
    },
    lastReadChapter: {
      id: "220",
      novelId: "3",
      title: "Chapter 220: The Monarch",
      number: 220,
      isRead: true,
      isDownloaded: false,
      releaseDate: new Date(),
    },
    progress: 81.5,
    totalChaptersRead: 220,
    lastReadDate: new Date(Date.now() - 86400000 * 30), // 30 days ago
    timeSpentReading: 890,
  },
];

interface HistoryContextType {
  historyEntries: HistoryEntry[];
  removeFromHistory: (entryId: string) => void;
  clearHistory: () => void;
  updateProgress: (
    entryId: string,
    chapterId: string,
    progress: number,
  ) => void;
  getTotalReadingTime: () => number;
  getTotalChaptersRead: () => number;
}

const HistoryContext = createContext<HistoryContextType | undefined>(undefined);

export const HistoryProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [historyEntries, setHistoryEntries] =
    useState<HistoryEntry[]>(mockHistoryEntries);

  const removeFromHistory = useCallback((entryId: string) => {
    setHistoryEntries((prev) => prev.filter((entry) => entry.id !== entryId));
  }, []);

  const clearHistory = useCallback(() => {
    setHistoryEntries([]);
  }, []);

  const updateProgress = useCallback(
    (entryId: string, chapterId: string, progress: number) => {
      setHistoryEntries((prev) =>
        prev.map((entry) => {
          if (entry.id === entryId) {
            return {
              ...entry,
              lastReadChapter: { ...entry.lastReadChapter, id: chapterId },
              progress,
              lastReadDate: new Date(),
            };
          }
          return entry;
        }),
      );
    },
    [],
  );

  const getTotalReadingTime = useCallback(() => {
    return historyEntries.reduce(
      (total, entry) => total + entry.timeSpentReading,
      0,
    );
  }, [historyEntries]);

  const getTotalChaptersRead = useCallback(() => {
    return historyEntries.reduce(
      (total, entry) => total + entry.totalChaptersRead,
      0,
    );
  }, [historyEntries]);

  return (
    <HistoryContext.Provider
      value={{
        historyEntries,
        removeFromHistory,
        clearHistory,
        updateProgress,
        getTotalReadingTime,
        getTotalChaptersRead,
      }}
    >
      {children}
    </HistoryContext.Provider>
  );
};

export const useHistory = () => {
  const context = useContext(HistoryContext);
  if (!context)
    throw new Error("useHistory must be used within HistoryProvider");
  return context;
};
