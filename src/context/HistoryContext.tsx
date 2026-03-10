// src/context/HistoryContext.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { DatabaseService } from "../services/database";
import { HistoryEntry } from "../types";

interface HistoryContextType {
  historyEntries: HistoryEntry[];
  removeFromHistory: (entryId: string) => void;
  clearHistory: () => void;
  upsertHistoryEntry: (entry: HistoryEntry) => void;
  updateProgress: (
    entryId: string,
    chapterId: string,
    progress: number,
  ) => void;
  getTotalReadingTime: () => number;
  getTotalChaptersRead: () => number;
  reloadFromDatabase: () => Promise<void>;
}

const HistoryContext = createContext<HistoryContextType | undefined>(undefined);

export const HistoryProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);

  const reloadFromDatabase = useCallback(async () => {
    const next = await DatabaseService.getHistory();
    setHistoryEntries(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await DatabaseService.initialize();
        const existing = await DatabaseService.getHistory();
        if (existing.length === 0) {
          // Only seed history if library seed already created everything.
          // If database is completely empty, LibraryContext will seed via replaceAll.
          const lib = await DatabaseService.getLibrary();
          if (lib.categories.length > 0 || lib.novels.length > 0) {
          }
        }
        if (cancelled) return;
        await reloadFromDatabase();
      } catch (e) {
        console.error("Failed to load history from database:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadFromDatabase]);

  const removeFromHistory = useCallback((entryId: string) => {
    setHistoryEntries((prev) => prev.filter((entry) => entry.id !== entryId));
    void DatabaseService.deleteHistoryEntry(entryId);
  }, []);

  const clearHistory = useCallback(() => {
    setHistoryEntries([]);
    void DatabaseService.clearHistory();
  }, []);

  const upsertHistoryEntry = useCallback((entry: HistoryEntry) => {
    setHistoryEntries((prev) => {
      const existingIndex = prev.findIndex((e) => e.id === entry.id);
      let next: HistoryEntry[];
      if (existingIndex >= 0) {
        next = prev.slice();
        next[existingIndex] = entry;
      } else {
        next = [...prev, entry];
      }
      next.sort(
        (a, b) =>
          (b.lastReadDate?.getTime() || 0) - (a.lastReadDate?.getTime() || 0),
      );
      return next;
    });
    void DatabaseService.upsertHistoryEntry(entry);
  }, []);

  const updateProgress = useCallback(
    (entryId: string, chapterId: string, progress: number) => {
      setHistoryEntries((prev) =>
        prev.map((entry) => {
          if (entry.id !== entryId) return entry;
          const updated: HistoryEntry = {
            ...entry,
            lastReadChapter: { ...entry.lastReadChapter, id: chapterId },
            progress,
            lastReadDate: new Date(),
          };
          void DatabaseService.upsertHistoryEntry(updated);
          return updated;
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
        reloadFromDatabase,
        upsertHistoryEntry,
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
