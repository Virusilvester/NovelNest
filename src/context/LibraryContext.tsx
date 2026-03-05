// src/context/LibraryContext.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { mockCategories, mockHistoryEntries, mockNovels } from "../data/mockData";
import { DatabaseService } from "../services/database";
import {
  Category,
  DisplayMode,
  LibraryFilterOption,
  LibrarySortOption,
  Novel,
} from "../types";
import { useSettings } from "./SettingsContext";

interface LibraryContextType {
  novels: Novel[];
  categories: Category[];
  selectedCategoryId: string;
  filterOptions: LibraryFilterOption;
  sortOption: LibrarySortOption;
  displayMode: DisplayMode;
  showDownloadBadges: boolean;
  showUnreadBadges: boolean;
  showItemCount: boolean;

  addNovel: (novel: Novel) => void;
  removeNovel: (id: string) => void;
  updateNovel: (id: string, updates: Partial<Novel>) => void;

  addCategory: (name: string) => void;
  removeCategory: (id: string) => void;
  reorderCategories: (orderedIds: string[]) => void;
  selectCategory: (id: string) => void;

  setFilterOptions: (options: LibraryFilterOption) => void;
  setSortOption: (option: LibrarySortOption) => void;
  setDisplayMode: (mode: DisplayMode) => void;
  setShowDownloadBadges: (show: boolean) => void;
  setShowUnreadBadges: (show: boolean) => void;
  setShowItemCount: (show: boolean) => void;

  updateLibrary: () => Promise<void>;
  getFilteredNovels: () => Novel[];
  reloadFromDatabase: () => Promise<void>;
}

const LibraryContext = createContext<LibraryContextType | undefined>(undefined);

export const LibraryProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const settings = useSettings();

  const [novels, setNovels] = useState<Novel[]>(mockNovels);
  const [categories, setCategories] = useState<Category[]>(mockCategories);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");

  const filterOptions = settings.settings.ui.libraryFilterOptions;
  const sortOption = settings.settings.ui.librarySortOption;
  const displayMode = settings.settings.ui.libraryDisplayMode;
  const showDownloadBadges = settings.settings.ui.showDownloadBadges;
  const showUnreadBadges = settings.settings.ui.showUnreadBadges;
  const showItemCount = settings.settings.ui.showItemCount;

  const reloadFromDatabase = useCallback(async () => {
    const next = await DatabaseService.getLibrary();
    setCategories(next.categories);
    setNovels(next.novels);
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await DatabaseService.initialize();
        const [lib, history] = await Promise.all([
          DatabaseService.getLibrary(),
          DatabaseService.getHistory(),
        ]);

        if (
          lib.categories.length === 0 &&
          lib.novels.length === 0 &&
          history.length === 0
        ) {
          await DatabaseService.replaceAll({
            categories: mockCategories,
            novels: mockNovels,
            history: mockHistoryEntries,
          });
        } else if (lib.categories.length === 0 && lib.novels.length === 0) {
          await DatabaseService.replaceAll({
            categories: mockCategories,
            novels: mockNovels,
            history,
          });
        }

        if (cancelled) return;
        await reloadFromDatabase();
      } catch (e) {
        console.error("Failed to bootstrap library database:", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [reloadFromDatabase]);

  const addNovel = useCallback((novel: Novel) => {
    setNovels((prev) => [...prev, novel]);
    DatabaseService.upsertNovel(novel).catch((e) => {
      console.error("Failed to persist novel:", novel?.id, e);
    });
  }, []);

  const removeNovel = useCallback((id: string) => {
    setNovels((prev) => prev.filter((n) => n.id !== id));
    DatabaseService.deleteNovel(id).catch((e) => {
      console.error("Failed to delete novel:", id, e);
    });
  }, []);

  const updateNovel = useCallback((id: string, updates: Partial<Novel>) => {
    setNovels((prev) => {
      let updatedAny = false;
      const next = prev.map((n) => {
        if (n.id !== id) return n;
        updatedAny = true;
        const updated = { ...n, ...updates };
        DatabaseService.upsertNovel(updated).catch((e) => {
          console.error("Failed to persist novel update:", id, e);
        });
        return updated;
      });
      return updatedAny ? next : prev;
    });
  }, []);

  const addCategory = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const newCategory: Category = {
        id: Date.now().toString(),
        name: trimmed,
        order: categories.length,
      };
      setCategories((prev) => [...prev, newCategory]);
      void DatabaseService.upsertCategory(newCategory);
    },
    [categories.length],
  );

  const removeCategory = useCallback(
    (id: string) => {
      if (id === "all") return;
      setCategories((prev) => prev.filter((c) => c.id !== id));
      void DatabaseService.deleteCategory(id);
      if (selectedCategoryId === id) setSelectedCategoryId("all");
    },
    [selectedCategoryId],
  );

  const reorderCategories = useCallback((orderedIds: string[]) => {
    setCategories((prev) => {
      const categoryMap = new Map(prev.map((c) => [c.id, c]));
      return orderedIds.map((id, index) => ({
        ...categoryMap.get(id)!,
        order: index,
      }));
    });
    void DatabaseService.reorderCategories(orderedIds);
  }, []);

  const selectCategory = useCallback((id: string) => {
    setSelectedCategoryId(id);
  }, []);

  const setFilterOptions = useCallback(
    (options: LibraryFilterOption) => {
      void settings.setLibraryFilterOptions(options);
    },
    [settings],
  );

  const setSortOption = useCallback(
    (option: LibrarySortOption) => {
      void settings.setLibrarySortOption(option);
    },
    [settings],
  );

  const setDisplayMode = useCallback(
    (mode: DisplayMode) => {
      void settings.setLibraryDisplayMode(mode);
    },
    [settings],
  );

  const setShowDownloadBadges = useCallback(
    (show: boolean) => {
      void settings.setShowDownloadBadges(show);
    },
    [settings],
  );

  const setShowUnreadBadges = useCallback(
    (show: boolean) => {
      void settings.setShowUnreadBadges(show);
    },
    [settings],
  );

  const setShowItemCount = useCallback(
    (show: boolean) => {
      void settings.setShowItemCount(show);
    },
    [settings],
  );

  const getFilteredNovels = useCallback(() => {
    let filtered = novels;

    if (selectedCategoryId !== "all") {
      filtered = filtered.filter((n) => n.categoryId === selectedCategoryId);
    }

    if (filterOptions.downloaded) filtered = filtered.filter((n) => n.isDownloaded);
    if (filterOptions.unread) filtered = filtered.filter((n) => n.unreadChapters > 0);
    if (filterOptions.completed) filtered = filtered.filter((n) => n.status === "completed");

    filtered = [...filtered];
    filtered.sort((a, b) => {
      switch (sortOption) {
        case "alphabetically":
          return a.title.localeCompare(b.title);
        case "lastRead": {
          const dateA = a.lastReadDate?.getTime() || 0;
          const dateB = b.lastReadDate?.getTime() || 0;
          return dateB - dateA;
        }
        case "unread":
          return b.unreadChapters - a.unreadChapters;
        case "totalChapters":
          return b.totalChapters - a.totalChapters;
        case "dateAdded":
          return parseInt(b.id) - parseInt(a.id);
        default:
          return 0;
      }
    });

    return filtered;
  }, [novels, selectedCategoryId, filterOptions, sortOption]);

  const updateLibrary = useCallback(async () => {
    console.log("Updating library...");
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }, []);

  return (
    <LibraryContext.Provider
      value={{
        novels,
        categories,
        selectedCategoryId,
        filterOptions,
        sortOption,
        displayMode,
        showDownloadBadges,
        showUnreadBadges,
        showItemCount,
        addNovel,
        removeNovel,
        updateNovel,
        addCategory,
        removeCategory,
        reorderCategories,
        selectCategory,
        setFilterOptions,
        setSortOption,
        setDisplayMode,
        setShowDownloadBadges,
        setShowUnreadBadges,
        setShowItemCount,
        updateLibrary,
        getFilteredNovels,
        reloadFromDatabase,
      }}
    >
      {children}
    </LibraryContext.Provider>
  );
};

export const useLibrary = () => {
  const context = useContext(LibraryContext);
  if (!context) throw new Error("useLibrary must be used within LibraryProvider");
  return context;
};
