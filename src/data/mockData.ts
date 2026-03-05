import { Category, HistoryEntry, Novel } from "../types";

export const mockCategories: Category[] = [
  { id: "all", name: "All", order: 0 },
  { id: "reading", name: "Reading", order: 1 },
  { id: "completed", name: "Completed", order: 2 },
  { id: "on_hold", name: "On Hold", order: 3 },
  { id: "plan_to_read", name: "Plan to Read", order: 4 },
  { id: "favorites", name: "Favorites", order: 5 },
];

export const mockNovels: Novel[] = [
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
    lastReadDate: new Date(Date.now() - 86400000 * 2),
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
    lastReadDate: new Date(Date.now() - 86400000 * 5),
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
    lastReadDate: new Date(Date.now() - 86400000 * 30),
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
      'Yeon-woo had a twin brother who disappeared five years ago. One day, a pocket watch left by his brother returned to his possession. Inside, he found a hidden diary in which was recorded "By the time you hear this, I guess I will be already deadâ€¦."',
    genres: ["Action", "Adventure", "Fantasy", "Supernatural"],
    totalChapters: 800,
    unreadChapters: 120,
    lastReadChapter: 680,
    lastReadDate: new Date(Date.now() - 86400000 * 1),
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
    lastReadDate: new Date(Date.now() - 86400000 * 10),
    isDownloaded: true,
    isInLibrary: true,
    categoryId: "favorites",
  },
];

export const mockHistoryEntries: HistoryEntry[] = [
  {
    id: "1",
    novel: mockNovels[0],
    lastReadChapter: {
      id: "405",
      novelId: "1",
      title: "Chapter 405: The Return",
      number: 405,
      isRead: true,
      isDownloaded: true,
      releaseDate: new Date(),
    },
    progress: 96.4,
    totalChaptersRead: 405,
    lastReadDate: new Date(Date.now() - 86400000 * 2),
    timeSpentReading: 1240,
  },
  {
    id: "2",
    novel: mockNovels[1],
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
    lastReadDate: new Date(Date.now() - 86400000 * 5),
    timeSpentReading: 2100,
  },
];

