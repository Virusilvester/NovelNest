import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { PluginRuntimeService } from "../services/pluginRuntime";
import { ChapterDownloads } from "../services/chapterDownloads";
import { useLibrary } from "./LibraryContext";
import { useSettings } from "./SettingsContext";

export type DownloadTaskStatus =
  | "pending"
  | "downloading"
  | "completed"
  | "error"
  | "canceled";

export type DownloadTask = {
  id: string;
  pluginId: string;
  pluginName?: string;
  novelId: string;
  novelTitle: string;
  chapterPath: string;
  chapterTitle: string;
  createdAt: number;
  status: DownloadTaskStatus;
  progress: number;
  errorMessage?: string;
};

type EnqueueInput = {
  pluginId: string;
  pluginName?: string;
  novelId: string;
  novelTitle: string;
  chapterPath: string;
  chapterTitle: string;
};

type DownloadQueueContextType = {
  tasks: DownloadTask[];
  paused: boolean;
  enqueue: (input: EnqueueInput | EnqueueInput[]) => void;
  togglePaused: () => void;
  cancelTask: (taskId: string) => void;
  cancelNovelTasks: (novelId: string) => void;
  retryTask: (taskId: string) => void;
  clearFinished: () => void;
};

const STORAGE_KEY = "@novelnest_download_queue_v1";

const DownloadQueueContext = createContext<DownloadQueueContextType | undefined>(
  undefined,
);

const clampProgress = (value: number) =>
  Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));

const taskIdFor = (input: EnqueueInput) => {
  const key = `${input.pluginId}::${input.novelId}::${input.chapterPath}`;
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${input.pluginId}::${input.novelId}::${hash >>> 0}`;
};

export const DownloadQueueProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { settings } = useSettings();
  const { novels, updateNovel } = useLibrary();

  const novelsRef = useRef(novels);
  useEffect(() => {
    novelsRef.current = novels;
  }, [novels]);

  const [tasks, setTasks] = useState<DownloadTask[]>([]);
  const [paused, setPaused] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const inflightRef = useRef(new Set<string>());
  const canceledRef = useRef(new Set<string>());
  const activePluginsRef = useRef(new Set<string>());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (cancelled) return;
        if (!raw) {
          setHydrated(true);
          return;
        }
        const parsed = JSON.parse(raw);
        const nextTasks = Array.isArray(parsed?.tasks) ? parsed.tasks : [];
        setTasks(
          nextTasks
            .map((t: any) => {
              const rawStatus = (t?.status as DownloadTaskStatus) || "pending";
              const status: DownloadTaskStatus =
                rawStatus === "downloading" ? "pending" : rawStatus;

              return {
                id: String(t?.id || ""),
                pluginId: String(t?.pluginId || ""),
                pluginName: t?.pluginName != null ? String(t.pluginName) : undefined,
                novelId: String(t?.novelId || ""),
                novelTitle: String(t?.novelTitle || ""),
                chapterPath: String(t?.chapterPath || ""),
                chapterTitle: String(t?.chapterTitle || ""),
                createdAt: Number(t?.createdAt || Date.now()),
                status,
                progress: clampProgress(Number(t?.progress ?? 0)),
                errorMessage: t?.errorMessage != null ? String(t.errorMessage) : undefined,
              };
            })
            .filter(
              (t: DownloadTask) =>
                t.id &&
                t.pluginId &&
                t.novelId &&
                t.chapterPath &&
                t.status !== "canceled",
            ),
        );
        setPaused(Boolean(parsed?.paused));
      } catch (e) {
        console.warn("Failed to load download queue:", e);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const payload = JSON.stringify({ version: 1, paused, tasks });
    AsyncStorage.setItem(STORAGE_KEY, payload).catch((e) => {
      console.warn("Failed to persist download queue:", e);
    });
  }, [hydrated, paused, tasks]);

  const enqueue = useCallback((input: EnqueueInput | EnqueueInput[]) => {
    const list = Array.isArray(input) ? input : [input];
    if (list.length === 0) return;

    setTasks((prev) => {
      const byId = new Map(prev.map((t) => [t.id, t]));
      let changed = false;
      const now = Date.now();

      for (const item of list) {
        if (!item || !item.pluginId || !item.novelId || !item.chapterPath) continue;
        const id = taskIdFor(item);
        canceledRef.current.delete(id);
        const existing = byId.get(id);
        if (existing) {
          if (existing.status === "completed") continue;
          if (existing.status === "pending" || existing.status === "downloading") continue;
          // error/canceled -> retry
          byId.set(id, {
            ...existing,
            status: "pending",
            progress: 0,
            errorMessage: undefined,
            createdAt: now,
            novelTitle: item.novelTitle || existing.novelTitle,
            chapterTitle: item.chapterTitle || existing.chapterTitle,
            pluginName: item.pluginName || existing.pluginName,
          });
          canceledRef.current.delete(id);
          changed = true;
          continue;
        }

        const task: DownloadTask = {
          id,
          pluginId: item.pluginId,
          pluginName: item.pluginName,
          novelId: item.novelId,
          novelTitle: item.novelTitle,
          chapterPath: item.chapterPath,
          chapterTitle: item.chapterTitle,
          createdAt: now,
          status: "pending",
          progress: 0,
        };
        byId.set(id, task);
        changed = true;
      }

      if (!changed) return prev;
      return Array.from(byId.values()).sort((a, b) => a.createdAt - b.createdAt);
    });
  }, []);

  const togglePaused = useCallback(() => {
    setPaused((p) => !p);
  }, []);

  const cancelTask = useCallback((taskId: string) => {
    if (!taskId) return;
    canceledRef.current.add(taskId);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }, []);

  const cancelNovelTasks = useCallback((novelId: string) => {
    if (!novelId) return;
    setTasks((prev) => {
      const next: DownloadTask[] = [];
      for (const task of prev) {
        if (task.novelId !== novelId) {
          next.push(task);
          continue;
        }
        canceledRef.current.add(task.id);
      }
      return next;
    });
  }, []);

  const retryTask = useCallback((taskId: string) => {
    if (!taskId) return;
    canceledRef.current.delete(taskId);
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status: "pending",
              progress: 0,
              createdAt: Date.now(),
              errorMessage: undefined,
            }
          : t,
      ),
    );
  }, []);

  const clearFinished = useCallback(() => {
    setTasks((prev) =>
      prev.filter((t) => t.status === "pending" || t.status === "downloading"),
    );
  }, []);

  const startTask = useCallback(
    async (task: DownloadTask) => {
      if (!task?.id) return;
      if (inflightRef.current.has(task.id)) return;
      if (activePluginsRef.current.has(task.pluginId)) return;

      inflightRef.current.add(task.id);
      activePluginsRef.current.add(task.pluginId);

      let started = false;
      setTasks((prev) => {
        const existing = prev.find((t) => t.id === task.id);
        if (!existing || existing.status !== "pending") return prev;
        started = true;
        return prev.map((t) =>
          t.id === task.id
            ? {
                ...t,
                status: "downloading",
                progress: 0,
                errorMessage: undefined,
              }
            : t,
        );
      });

      if (!started) {
        inflightRef.current.delete(task.id);
        activePluginsRef.current.delete(task.pluginId);
        return;
      }

      const downloadLocation = settings.general.downloadLocation;
      let wroteFile = false;

      try {
        if (canceledRef.current.has(task.id)) return;

        const installed = settings.extensions.installedPlugins || {};
        const plugin = installed[task.pluginId];
        if (!plugin) throw new Error("Plugin not installed.");
        if (!plugin.enabled) throw new Error("Plugin is disabled.");

        const instance = await PluginRuntimeService.loadLnReaderPlugin(plugin, {
          userAgent: settings.advanced.userAgent,
        });
        const parseChapter = (instance as any).parseChapter;
        if (typeof parseChapter !== "function") {
          throw new Error("This plugin does not support chapters.");
        }

        const html =
          ((await parseChapter.call(instance, task.chapterPath)) as string) || "";

        if (canceledRef.current.has(task.id)) {
          return;
        }

        await ChapterDownloads.writeChapterHtml(
          task.pluginId,
          task.novelId,
          task.chapterPath,
          html,
          downloadLocation,
        );
        wroteFile = true;

        if (canceledRef.current.has(task.id)) {
          return;
        }

        if (canceledRef.current.has(task.id)) return;
        const novel = novelsRef.current.find((n) => n.id === task.novelId);
        if (novel) {
          updateNovel(task.novelId, {
            isDownloaded: true,
            chapterDownloaded: {
              ...(novel.chapterDownloaded || {}),
              [task.chapterPath]: true,
            },
          });
        }

        if (canceledRef.current.has(task.id)) return;

        setTasks((prev) => prev.filter((t) => t.id !== task.id));
      } catch (e: any) {
        const message = e?.message ? String(e.message) : "Download failed.";
        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id
              ? { ...t, status: "error", errorMessage: message, progress: 0 }
              : t,
          ),
        );
      } finally {
        inflightRef.current.delete(task.id);
        activePluginsRef.current.delete(task.pluginId);

        const wasCanceled = canceledRef.current.has(task.id);
        canceledRef.current.delete(task.id);

        if (wasCanceled) {
          if (wroteFile) {
            await ChapterDownloads.deleteChapterHtml(
              task.pluginId,
              task.novelId,
              task.chapterPath,
              downloadLocation,
            );
          }

          const novel = novelsRef.current.find((n) => n.id === task.novelId);
          if (novel?.chapterDownloaded?.[task.chapterPath]) {
            const next = { ...(novel.chapterDownloaded || {}) };
            delete next[task.chapterPath];
            const keys = Object.keys(next);
            updateNovel(task.novelId, {
              chapterDownloaded: keys.length ? next : undefined,
              isDownloaded: keys.length > 0,
            });
          }

          setTasks((prev) => prev.filter((t) => t.id !== task.id));
        }
      }
    },
    [
      settings.advanced.userAgent,
      settings.extensions.installedPlugins,
      settings.general.downloadLocation,
      updateNovel,
    ],
  );

  useEffect(() => {
    if (!hydrated) return;
    if (paused) return;

    const pendingByPlugin = new Set<string>();

    for (const t of tasks) {
      if (t.status === "pending") pendingByPlugin.add(t.pluginId);
    }

    for (const pluginId of pendingByPlugin) {
      if (activePluginsRef.current.has(pluginId)) continue;
      const next = tasks
        .filter((t) => t.pluginId === pluginId && t.status === "pending")
        .sort((a, b) => a.createdAt - b.createdAt)[0];
      if (!next) continue;
      void startTask(next);
    }
  }, [hydrated, paused, startTask, tasks]);

  const value = useMemo(
    () => ({
      tasks,
      paused,
      enqueue,
      togglePaused,
      cancelTask,
      cancelNovelTasks,
      retryTask,
      clearFinished,
    }),
    [
      cancelNovelTasks,
      cancelTask,
      clearFinished,
      enqueue,
      paused,
      retryTask,
      tasks,
      togglePaused,
    ],
  );

  return (
    <DownloadQueueContext.Provider value={value}>
      {children}
    </DownloadQueueContext.Provider>
  );
};

export const useDownloadQueue = () => {
  const ctx = useContext(DownloadQueueContext);
  if (!ctx) {
    throw new Error("useDownloadQueue must be used within DownloadQueueProvider");
  }
  return ctx;
};
