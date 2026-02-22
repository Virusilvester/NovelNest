// src/context/LibraryContext.tsx
import React, { createContext, useCallback, useContext, useState } from "react";
import {
  Category,
  DisplayMode,
  LibraryFilterOption,
  LibrarySortOption,
  Novel,
} from "../types";

interface LibraryContextType {
  novels: Novel[];
  categories: Category[];
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
  setFilterOptions: (options: LibraryFilterOption) => void;
  setSortOption: (option: LibrarySortOption) => void;
  setDisplayMode: (mode: DisplayMode) => void;
  setShowDownloadBadges: (show: boolean) => void;
  setShowUnreadBadges: (show: boolean) => void;
  setShowItemCount: (show: boolean) => void;
  updateLibrary: () => Promise<void>;
}

const LibraryContext = createContext<LibraryContextType | undefined>(undefined);

export const LibraryProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [novels, setNovels] = useState<Novel[]>([]);
  const [categories, setCategories] = useState<Category[]>([
    { id: "1", name: "Default", order: 0, novelIds: [] },
  ]);
  const [filterOptions, setFilterOptions] = useState<LibraryFilterOption>({
    downloaded: false,
    unread: false,
    completed: false,
  });
  const [sortOption, setSortOption] = useState<LibrarySortOption>("lastRead");
  const [displayMode, setDisplayMode] = useState<DisplayMode>("compactGrid");
  const [showDownloadBadges, setShowDownloadBadges] = useState(true);
  const [showUnreadBadges, setShowUnreadBadges] = useState(true);
  const [showItemCount, setShowItemCount] = useState(true);

  const addNovel = useCallback((novel: Novel) => {
    setNovels((prev) => [...prev, novel]);
  }, []);

  const removeNovel = useCallback((id: string) => {
    setNovels((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const updateNovel = useCallback((id: string, updates: Partial<Novel>) => {
    setNovels((prev) =>
      prev.map((n) => (n.id === id ? { ...n, ...updates } : n)),
    );
  }, []);

  const addCategory = useCallback(
    (name: string) => {
      const newCategory: Category = {
        id: Date.now().toString(),
        name,
        order: categories.length,
        novelIds: [],
      };
      setCategories((prev) => [...prev, newCategory]);
    },
    [categories.length],
  );

  const removeCategory = useCallback((id: string) => {
    setCategories((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const reorderCategories = useCallback((orderedIds: string[]) => {
    setCategories((prev) => {
      const categoryMap = new Map(prev.map((c) => [c.id, c]));
      return orderedIds.map((id, index) => ({
        ...categoryMap.get(id)!,
        order: index,
      }));
    });
  }, []);

  const updateLibrary = useCallback(async () => {
    // Implementation for updating library
    console.log("Updating library...");
  }, []);

  return (
    <LibraryContext.Provider
      value={{
        novels,
        categories,
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
        setFilterOptions,
        setSortOption,
        setDisplayMode,
        setShowDownloadBadges,
        setShowUnreadBadges,
        setShowItemCount,
        updateLibrary,
      }}
    >
      {children}
    </LibraryContext.Provider>
  );
};

export const useLibrary = () => {
  const context = useContext(LibraryContext);
  if (!context)
    throw new Error("useLibrary must be used within LibraryProvider");
  return context;
};
