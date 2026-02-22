// src/context/LibraryContext.tsx
import React, { createContext, useCallback, useContext, useState } from "react";
import {
  Category,
  DisplayMode,
  LibraryFilterOption,
  LibrarySortOption,
  Novel,
} from "../types";

// Mock Categories
const mockCategories: Category[] = [
  { id: "all", name: "All", order: 0 },
  { id: "reading", name: "Reading", order: 1 },
  { id: "completed", name: "Completed", order: 2 },
  { id: "on_hold", name: "On Hold", order: 3 },
  { id: "plan_to_read", name: "Plan to Read", order: 4 },
  { id: "favorites", name: "Favorites", order: 5 },
];

// Mock Novels with diverse data
const mockNovels: Novel[] = [
  {
    id: "1",
    title: "The Beginning After The End",
    author: "TurtleMe",
    coverUrl:
      "https://cdn.novelupdates.com/images/2021/06/The-Beginning-After-The-End-Kindle.jpg",
    status: "ongoing",
    source: "Novel Updates",
    summary:
      "King Grey has unrivaled strength, wealth, and prestige in a world governed by martial ability. However, solitude lingers closely behind those with great power. Beneath the glamorous exterior of a powerful king lurks the shell of man, devoid of purpose and will.",
    genres: ["Action", "Adventure", "Fantasy", "Magic"],
    totalChapters: 420,
    unreadChapters: 15,
    lastReadChapter: 405,
    lastReadDate: new Date(Date.now() - 86400000 * 2), // 2 days ago
    isDownloaded: true,
    isInLibrary: true,
    categoryId: "reading",
  },
  {
    id: "2",
    title: "Omniscient Reader's Viewpoint",
    author: "Sing-Shong",
    coverUrl:
      "https://cdn.novelupdates.com/images/2020/03/Omniscient-Readers-Viewpoint.jpg",
    status: "completed",
    source: "Novel Updates",
    summary:
      "Only I know the end of this world. One day our MC finds himself stuck in the world of his favorite webnovel. What does he do to survive? It is a world struck by catastrophe and danger all around.",
    genres: ["Action", "Adventure", "Fantasy", "Psychological"],
    totalChapters: 551,
    unreadChapters: 0,
    lastReadChapter: 551,
    lastReadDate: new Date(Date.now() - 86400000 * 5), // 5 days ago
    isDownloaded: true,
    isInLibrary: true,
    categoryId: "completed",
  },
  {
    id: "3",
    title: "Solo Leveling",
    author: "Chugong",
    coverUrl: "https://cdn.novelupdates.com/images/2019/12/solo-leveling.jpg",
    status: "completed",
    source: "Novel Updates",
    summary:
      '10 years ago, after "the Gate" that connected the real world with the monster world opened, some of the ordinary, everyday people received the power to hunt monsters within the Gate. They are known as "Hunters".',
    genres: ["Action", "Adventure", "Fantasy", "Supernatural"],
    totalChapters: 270,
    unreadChapters: 50,
    lastReadChapter: 220,
    lastReadDate: new Date(Date.now() - 86400000 * 30), // 30 days ago
    isDownloaded: false,
    isInLibrary: true,
    categoryId: "on_hold",
  },
  {
    id: "4",
    title: "Second Life Ranker",
    author: "Sa Doyeon",
    coverUrl:
      "https://cdn.novelupdates.com/images/2019/06/secondliferanker.jpg",
    status: "ongoing",
    source: "Novel Updates",
    summary:
      'Yeon-woo had a twin brother who disappeared five years ago. One day, a pocket watch left by his brother returned to his possession. Inside, he found a hidden diary in which was recorded "By the time you hear this, I guess I will be already dead…."',
    genres: ["Action", "Adventure", "Fantasy", "Supernatural"],
    totalChapters: 800,
    unreadChapters: 120,
    lastReadChapter: 680,
    lastReadDate: new Date(Date.now() - 86400000 * 1), // 1 day ago
    isDownloaded: true,
    isInLibrary: true,
    categoryId: "reading",
  },
  {
    id: "5",
    title: "The Legendary Mechanic",
    author: "Chocolion",
    coverUrl:
      "https://cdn.novelupdates.com/images/2019/08/The-Legendary-Mechanic.jpg",
    status: "completed",
    source: "Novel Updates",
    summary:
      "Han Xiao was a professional power leveler before his transmigration. Using the player's interface, Han Xiao traversed across the universe and came to the future world.",
    genres: ["Action", "Adventure", "Sci-fi", "Game"],
    totalChapters: 1463,
    unreadChapters: 1463,
    lastReadChapter: 0,
    lastReadDate: undefined,
    isDownloaded: false,
    isInLibrary: true,
    categoryId: "plan_to_read",
  },
  {
    id: "6",
    title: "Lord of the Mysteries",
    author: "Cuttlefish That Loves Diving",
    coverUrl:
      "https://cdn.novelupdates.com/images/2019/05/Lord-of-the-Mysteries.jpg",
    status: "completed",
    source: "Novel Updates",
    summary:
      "In the waves of steam and machinery, who could achieve extraordinary? In the fogs of history and darkness, who was whispering? I woke up from the realm of mysteries and opened my eyes to the world.",
    genres: ["Action", "Adventure", "Fantasy", "Mystery"],
    totalChapters: 1394,
    unreadChapters: 0,
    lastReadChapter: 1394,
    lastReadDate: new Date(Date.now() - 86400000 * 10), // 10 days ago
    isDownloaded: true,
    isInLibrary: true,
    categoryId: "favorites",
  },
  {
    id: "7",
    title: "Shadow Slave",
    author: "Guiltythree",
    coverUrl: "https://cdn.novelupdates.com/images/2021/11/Shadow-Slave.jpg",
    status: "ongoing",
    source: "Novel Updates",
    summary:
      "Growing up in poverty, Sunny never expected anything good from life. However, even he did not anticipate being chosen by the Nightmare Spell and becoming one of the Awakened, an elite group of people gifted with supernatural powers.",
    genres: ["Action", "Adventure", "Fantasy", "Supernatural"],
    totalChapters: 1200,
    unreadChapters: 45,
    lastReadChapter: 1155,
    lastReadDate: new Date(Date.now() - 86400000 * 0.5), // 12 hours ago
    isDownloaded: true,
    isInLibrary: true,
    categoryId: "reading",
  },
  {
    id: "8",
    title: "Martial World",
    author: "Cocooned Cow",
    coverUrl: "https://cdn.novelupdates.com/images/2016/03/Martial-World.jpg",
    status: "completed",
    source: "Novel Updates",
    summary:
      "In the Realm of the Gods, countless legends fought over a mysterious cube. After the battle it disappeared into the void. Lin Ming stumbles upon this mystery object and begins his journey to become a hero of his own.",
    genres: ["Action", "Adventure", "Fantasy", "Martial Arts"],
    totalChapters: 2275,
    unreadChapters: 0,
    lastReadChapter: 2275,
    lastReadDate: new Date(Date.now() - 86400000 * 60), // 60 days ago
    isDownloaded: false,
    isInLibrary: true,
    categoryId: "completed",
  },
  {
    id: "9",
    title: "Reverend Insanity",
    author: "Gu Zhen Ren",
    coverUrl:
      "https://cdn.novelupdates.com/images/2017/03/Reverend-Insanity.jpg",
    status: "ongoing",
    source: "Novel Updates",
    summary:
      "Humans are clever in tens of thousands of ways, Gu are the true refined essences of Heaven and Earth. The Three Temples are unrighteous, the demon is reborn. Former days are but an old dream, an identical name is made anew.",
    genres: ["Action", "Adventure", "Fantasy", "Mature"],
    totalChapters: 2334,
    unreadChapters: 200,
    lastReadChapter: 2134,
    lastReadDate: new Date(Date.now() - 86400000 * 45), // 45 days ago
    isDownloaded: false,
    isInLibrary: true,
    categoryId: "on_hold",
  },
  {
    id: "10",
    title: "A Will Eternal",
    author: "Er Gen",
    coverUrl: "https://cdn.novelupdates.com/images/2016/05/A-Will-Eternal.jpg",
    status: "completed",
    source: "Novel Updates",
    summary:
      "One will to create oceans. One will to summon the mulberry fields. One will to slaughter countless devils. One will to eradicate innumerable immortals. Only my will… is eternal.",
    genres: ["Action", "Adventure", "Comedy", "Fantasy"],
    totalChapters: 1314,
    unreadChapters: 0,
    lastReadChapter: 1314,
    lastReadDate: new Date(Date.now() - 86400000 * 15), // 15 days ago
    isDownloaded: true,
    isInLibrary: true,
    categoryId: "favorites",
  },
  {
    id: "11",
    title: "Overgeared",
    author: "Park Saenal",
    coverUrl: "https://cdn.novelupdates.com/images/2017/03/Overgeared.jpg",
    status: "ongoing",
    source: "Novel Updates",
    summary:
      "As Shin Youngwoo has had an unfortunate life and is now stuck carrying bricks on construction sites. He even had to do labor in the VR game, Satisfy! However, luck would soon enter his hopeless life.",
    genres: ["Action", "Adventure", "Comedy", "Game"],
    totalChapters: 1800,
    unreadChapters: 80,
    lastReadChapter: 1720,
    lastReadDate: new Date(Date.now() - 86400000 * 3), // 3 days ago
    isDownloaded: true,
    isInLibrary: true,
    categoryId: "reading",
  },
  {
    id: "12",
    title: "The Novel's Extra",
    author: "Jee Gab Song",
    coverUrl:
      "https://cdn.novelupdates.com/images/2018/11/The-Novels-Extra.jpg",
    status: "completed",
    source: "Novel Updates",
    summary:
      "Waking up, Kim Hajin finds himself in a familiar world but an unfamiliar body. A world he created himself and a story he wrote, yet never finished. He had become his novel's extra, a filler character with no importance to the story.",
    genres: ["Action", "Adventure", "Drama", "Fantasy"],
    totalChapters: 379,
    unreadChapters: 379,
    lastReadChapter: 0,
    lastReadDate: undefined,
    isDownloaded: false,
    isInLibrary: true,
    categoryId: "plan_to_read",
  },
];

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
}

const LibraryContext = createContext<LibraryContextType | undefined>(undefined);

export const LibraryProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [novels, setNovels] = useState<Novel[]>(mockNovels);
  const [categories, setCategories] = useState<Category[]>(mockCategories);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");
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
      };
      setCategories((prev) => [...prev, newCategory]);
    },
    [categories.length],
  );

  const removeCategory = useCallback(
    (id: string) => {
      if (id === "all") return; // Prevent deleting "All" category
      setCategories((prev) => prev.filter((c) => c.id !== id));
      if (selectedCategoryId === id) {
        setSelectedCategoryId("all");
      }
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
  }, []);

  const selectCategory = useCallback((id: string) => {
    setSelectedCategoryId(id);
  }, []);

  const getFilteredNovels = useCallback(() => {
    let filtered = novels;

    // Filter by category
    if (selectedCategoryId !== "all") {
      filtered = filtered.filter((n) => n.categoryId === selectedCategoryId);
    }

    // Apply filter options
    if (filterOptions.downloaded) {
      filtered = filtered.filter((n) => n.isDownloaded);
    }
    if (filterOptions.unread) {
      filtered = filtered.filter((n) => n.unreadChapters > 0);
    }
    if (filterOptions.completed) {
      filtered = filtered.filter((n) => n.status === "completed");
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortOption) {
        case "alphabetically":
          return a.title.localeCompare(b.title);
        case "lastRead":
          const dateA = a.lastReadDate?.getTime() || 0;
          const dateB = b.lastReadDate?.getTime() || 0;
          return dateB - dateA;
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
    // Mock update logic
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
