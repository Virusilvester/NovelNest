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
import { ChapterDownloads } from "../services/chapterDownloads";
import { PluginRuntimeService } from "../services/pluginRuntime";
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

declare global {
  var __fileSystemTested: boolean | undefined;
}

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

const downloadChapterContent = async (
  task: DownloadTask,
  settings: any,
  getNovels: () => any[],
): Promise<string> => {
  console.log('📖 LNReader-style download for:', {
    pluginId: task.pluginId,
    novelId: task.novelId,
    chapterPath: task.chapterPath,
  });

  const novels = getNovels();
  const novel = novels.find((n) => n.id === task.novelId);
  if (novel?.chapterDownloaded?.[task.chapterPath]) {
    console.log('✅ Chapter already downloaded, skipping');
    const cached = await ChapterDownloads.readChapterHtml(
      task.pluginId,
      task.novelId,
      task.chapterPath,
      settings.general.downloadLocation,
    );
    if (cached) return cached;
  }

  const installed = settings.extensions.installedPlugins || {};
  const plugin = installed[task.pluginId];
  if (!plugin) throw new Error(`Plugin ${task.pluginId} not installed.`);
  if (!plugin.enabled) throw new Error(`Plugin ${task.pluginId} is disabled.`);

  console.log('🔌 Loading plugin:', plugin.name);
  const instance = await Promise.race([
    PluginRuntimeService.loadLnReaderPlugin(plugin, {
      userAgent: settings.advanced.userAgent,
    }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Plugin loading timeout (15s)')), 15000)
    ),
  ]);

  const parseChapter = (instance as any).parseChapter;
  if (typeof parseChapter !== "function") {
    throw new Error(`Plugin ${task.pluginId} does not support chapters.`);
  }

  console.log('📄 Parsing chapter content...');
  let chapterText = "";
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts && !chapterText) {
    try {
      chapterText = await Promise.race([
        parseChapter.call(instance, task.chapterPath),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error(`Chapter parsing timeout (30s) - attempt ${attempts + 1}`)),
            30000
          )
        ),
      ]);
      if (!chapterText || chapterText.trim().length === 0) {
        throw new Error('Chapter content is empty');
      }
    } catch (e: any) {
      attempts++;
      console.log(`⚠️ Chapter parse attempt ${attempts} failed:`, e.message);
      if (attempts >= maxAttempts) {
        throw new Error(`Failed to parse chapter after ${maxAttempts} attempts: ${e.message}`);
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log('✅ Chapter parsed successfully, length:', chapterText.length);
  return chapterText;
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

  // FIX: Keep a ref that always mirrors tasks state so startTask can read
  // current status synchronously without relying on async setTasks callbacks.
  const tasksRef = useRef<DownloadTask[]>([]);
  const setTasksAndRef = useCallback((updater: (prev: DownloadTask[]) => DownloadTask[]) => {
    setTasks((prev) => {
      const next = updater(prev);
      tasksRef.current = next;
      return next;
    });
  }, []);

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
        const loaded = nextTasks
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
          );
        tasksRef.current = loaded;
        setTasks(loaded);
        setPaused(Boolean(parsed?.paused));
      } catch (e) {
        console.warn("Failed to load download queue:", e);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => { cancelled = true; };
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

    console.log('Enqueuing download tasks:', list.map(t => ({
      novelId: t.novelId,
      chapterPath: t.chapterPath,
      pluginId: t.pluginId,
    })));

    setTasksAndRef((prev) => {
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
      const result = Array.from(byId.values()).sort((a, b) => a.createdAt - b.createdAt);
      console.log('Updated download queue:', result.map(t => ({
        id: t.id,
        status: t.status,
        chapterPath: t.chapterPath,
      })));
      return result;
    });
  }, [setTasksAndRef]);

  const togglePaused = useCallback(() => setPaused((p) => !p), []);

  const cancelTask = useCallback((taskId: string) => {
    if (!taskId) return;
    canceledRef.current.add(taskId);
    setTasksAndRef((prev) => prev.filter((t) => t.id !== taskId));
  }, [setTasksAndRef]);

  const cancelNovelTasks = useCallback((novelId: string) => {
    if (!novelId) return;
    setTasksAndRef((prev) => {
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
  }, [setTasksAndRef]);

  const retryTask = useCallback((taskId: string) => {
    if (!taskId) return;
    canceledRef.current.delete(taskId);
    setTasksAndRef((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, status: "pending", progress: 0, createdAt: Date.now(), errorMessage: undefined }
          : t,
      ),
    );
  }, [setTasksAndRef]);

  const clearFinished = useCallback(() => {
    setTasksAndRef((prev) => prev.filter((t) => t.status !== "completed"));
  }, [setTasksAndRef]);

  const startTask = useCallback(
    async (task: DownloadTask) => {
      if (!task?.id) return;

      // FIX: Guard checks use refs — all synchronous, no race with setTasks callbacks.
      if (inflightRef.current.has(task.id)) {
        console.log('⏸️ Task already inflight, skipping:', task.id);
        return;
      }
      if (activePluginsRef.current.has(task.pluginId)) {
        console.log('⏸️ Plugin already active, skipping:', task.pluginId);
        return;
      }

      // FIX: Verify the task is actually pending using tasksRef (synchronous read).
      const currentTask = tasksRef.current.find((t) => t.id === task.id);
      if (!currentTask || currentTask.status !== 'pending') {
        console.log('⏸️ Task is not pending, skipping:', { taskId: task.id, status: currentTask?.status });
        return;
      }

      console.log('🚀 Starting download task execution:', {
        id: task.id,
        chapterPath: task.chapterPath,
        pluginId: task.pluginId,
        novelId: task.novelId,
      });

      if (!globalThis.__fileSystemTested) {
        console.log('🧪 Running file system test...');
        const fsTest = await ChapterDownloads.testFileSystem();
        globalThis.__fileSystemTested = true;
        if (!fsTest) {
          console.error('❌ File system test failed');
          setTasksAndRef((prev) =>
            prev.map((t) =>
              t.id === task.id
                ? { ...t, status: "error" as const, errorMessage: "File system test failed" }
                : t,
            ),
          );
          return;
        }
      }

      // Claim the task — mark refs first, then update state.
      inflightRef.current.add(task.id);
      activePluginsRef.current.add(task.pluginId);
      console.log('🔒 Task marked as inflight and plugin as active');

      // FIX: Update task status to downloading directly — no shouldProceed flag needed
      // because we already verified status synchronously above via tasksRef.
      setTasksAndRef((prev) =>
        prev.map((t) =>
          t.id === task.id
            ? { ...t, status: "downloading" as const, progress: 0, errorMessage: undefined }
            : t,
        ),
      );
      console.log('✅ Task status changed to downloading');

      const downloadLocation = settings.general.downloadLocation;
      let wroteFile = false;

      try {
        if (canceledRef.current.has(task.id)) return;

        console.log('📖 STEP 1: Starting chapter content download');
        const html = await downloadChapterContent(task, settings, () => novelsRef.current);
        console.log('✅ STEP 1 COMPLETED: Chapter content loaded, length:', html.length);

        if (canceledRef.current.has(task.id)) return;

        console.log('💾 STEP 2: Writing chapter to file system');
        await ChapterDownloads.writeChapterHtml(
          task.pluginId,
          task.novelId,
          task.chapterPath,
          html,
          downloadLocation,
        );
        wroteFile = true;
        console.log('✅ STEP 2 COMPLETED: Chapter file written successfully');

        if (canceledRef.current.has(task.id)) return;

        console.log('📚 STEP 3: Updating novel state');
        const novel = novelsRef.current.find((n) => n.id === task.novelId);
        if (novel) {
          updateNovel(task.novelId, {
            isDownloaded: true,
            chapterDownloaded: {
              ...(novel.chapterDownloaded || {}),
              [task.chapterPath]: true,
            },
          });
          console.log('✅ STEP 3 COMPLETED: Novel state updated successfully');
        }

        if (canceledRef.current.has(task.id)) return;

        console.log('🏁 STEP 4: Marking task as completed');
        setTasksAndRef((prev) =>
          prev.map((t) =>
            t.id === task.id ? { ...t, status: "completed" as const, progress: 100 } : t,
          ),
        );
        console.log('✅ Task marked as completed');
        
        // Show completed status briefly before auto-removing
        console.log('⏳ Showing completed status for 2 seconds before auto-removal');
        await new Promise((resolve) => setTimeout(resolve, 2000));
        
        // Auto-remove completed task from UI
        setTasksAndRef((prev) => prev.filter((t) => t.id !== task.id));
        console.log('🧹 Completed task auto-removed from queue UI');

      } catch (e: any) {
        console.log('❌ Download failed with error:', e);
        const message = e?.message ? String(e.message) : "Download failed.";
        if (!canceledRef.current.has(task.id)) {
          setTasksAndRef((prev) =>
            prev.map((t) =>
              t.id === task.id
                ? { ...t, status: "error", errorMessage: message, progress: 0 }
                : t,
            ),
          );
        }
      } finally {
        // Always release the plugin slot and inflight marker.
        inflightRef.current.delete(task.id);
        activePluginsRef.current.delete(task.pluginId);
        console.log('🧹 Cleaned up refs for task:', {
          taskId: task.id,
          pluginId: task.pluginId,
          remainingInflight: inflightRef.current.size,
          remainingActivePlugins: activePluginsRef.current.size,
        });

        const wasCanceled = canceledRef.current.has(task.id);
        if (wasCanceled) {
          if (wroteFile) {
            try {
              await ChapterDownloads.deleteChapterHtml(
                task.pluginId,
                task.novelId,
                task.chapterPath,
                downloadLocation,
              );
            } catch (deleteError) {
              console.log('⚠️ Failed to delete canceled download file:', deleteError);
            }
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

          setTasksAndRef((prev) => prev.filter((t) => t.id !== task.id));
        }

        canceledRef.current.delete(task.id);
        console.log('✅ Task cleanup completed');
      }
    },
    [settings, updateNovel, setTasksAndRef],
  );

  useEffect(() => {
    if (!hydrated || paused) return;

    const pendingByPlugin = new Map<string, DownloadTask>();
    const downloadingPlugins = new Set<string>();

    for (const t of tasks) {
      if (t.status === "pending") {
        const existing = pendingByPlugin.get(t.pluginId);
        if (!existing || t.createdAt < existing.createdAt) {
          pendingByPlugin.set(t.pluginId, t);
        }
      } else if (t.status === "downloading") {
        downloadingPlugins.add(t.pluginId);
      }
    }

    console.log('📊 Queue analysis:', {
      totalTasks: tasks.length,
      pendingTasks: tasks.filter(t => t.status === 'pending').length,
      downloadingTasks: tasks.filter(t => t.status === 'downloading').length,
      pendingByPlugin: Array.from(pendingByPlugin.entries()).map(([k, v]) => ({ pluginId: k, taskId: v.id })),
      downloadingPlugins: Array.from(downloadingPlugins),
    });

    for (const [pluginId, task] of pendingByPlugin.entries()) {
      // Skip if plugin already has a downloading task (state check)
      if (downloadingPlugins.has(pluginId)) continue;
      // Skip if already claimed by an inflight execution (ref check)
      if (inflightRef.current.has(task.id)) continue;
      if (activePluginsRef.current.has(pluginId)) continue;

      console.log('🚀 Starting download task:', { id: task.id, chapterPath: task.chapterPath });
      void startTask(task);
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
    [cancelNovelTasks, cancelTask, clearFinished, enqueue, paused, retryTask, tasks, togglePaused],
  );

  return (
    <DownloadQueueContext.Provider value={value}>
      {children}
    </DownloadQueueContext.Provider>
  );
};

export const useDownloadQueue = () => {
  const ctx = useContext(DownloadQueueContext);
  if (!ctx) throw new Error("useDownloadQueue must be used within DownloadQueueProvider");
  return ctx;
};