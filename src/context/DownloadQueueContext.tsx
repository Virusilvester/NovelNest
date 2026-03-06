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

// Reusable function to load chapter content (mirrors ReaderScreen.loadChapterHtml)
const loadChapterContent = async (
  chapterPath: string,
  pluginId: string,
  novelId: string,
  settings: any,
  getNovels: () => any[], // Function to get latest novels
): Promise<string> => {
  console.log('📖 Loading chapter content for download:', { chapterPath, pluginId, novelId });

  // Always try file system first (for downloads, we want the latest content)
  console.log('📁 Checking file system first...');
  const fileContent = await ChapterDownloads.readChapterHtml(
    pluginId,
    novelId,
    chapterPath,
    settings.general.downloadLocation,
  );
  
  if (fileContent != null) {
    console.log('✅ Found content in file system, using cached version');
    return fileContent;
  }

  // If not in file system, check novel state to avoid re-downloading
  const novels = getNovels(); // Get latest novels
  const novel = novels.find((n) => n.id === novelId);
  if (novel?.chapterDownloaded?.[chapterPath]) {
    console.log('⚠️ Chapter marked as downloaded but file not found, fetching from plugin');
  } else {
    console.log('🔌 Chapter not downloaded, fetching from plugin');
  }

  // Load from plugin
  const installed = settings.extensions.installedPlugins || {};
  const plugin = installed[pluginId];
  if (!plugin) throw new Error("Plugin not installed.");
  if (!plugin.enabled) throw new Error("Plugin is disabled.");

  const instance = await PluginRuntimeService.loadLnReaderPlugin(plugin, {
    userAgent: settings.advanced.userAgent,
  });
  const parseChapter = (instance as any).parseChapter;
  if (typeof parseChapter !== "function") {
    throw new Error("This plugin does not support chapters.");
  }

  const content = (await parseChapter.call(instance, chapterPath)) || "";
  console.log('✅ Loaded from plugin successfully, length:', content.length);
  return content;
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

    console.log('Enqueuing download tasks:', list.map(t => ({ 
      novelId: t.novelId, 
      chapterPath: t.chapterPath, 
      pluginId: t.pluginId 
    })));

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
      const result = Array.from(byId.values()).sort((a, b) => a.createdAt - b.createdAt);
      console.log('Updated download queue:', result.map(t => ({ 
        id: t.id, 
        status: t.status, 
        chapterPath: t.chapterPath 
      })));
      return result;
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
      prev.filter((t) => t.status !== "completed"),
    );
  }, []);

  // Helper to clean up refs - MUST be called in all exit paths
  const cleanupTaskRefs = useCallback((taskId: string, pluginId: string) => {
    inflightRef.current.delete(taskId);
    activePluginsRef.current.delete(pluginId);
    console.log('🧹 Cleaned up refs for task:', { taskId, pluginId, remainingInflight: inflightRef.current.size, remainingActivePlugins: activePluginsRef.current.size });
  }, []);

  const startTask = useCallback(
    async (task: DownloadTask) => {
      if (!task?.id) return;
      
      // Check if already processing this exact task
      if (inflightRef.current.has(task.id)) {
        console.log('❌ Task already in flight:', task.id);
        return;
      }
      
      // Check if plugin is busy with another task
      if (activePluginsRef.current.has(task.pluginId)) {
        console.log('❌ Plugin already active:', task.pluginId);
        return;
      }

      console.log('🚀 Starting download task execution:', { 
        id: task.id, 
        chapterPath: task.chapterPath,
        pluginId: task.pluginId,
        novelId: task.novelId
      });

      // Test file system first (only once per session)
      if (!globalThis.__fileSystemTested) {
        console.log('🧪 Running file system test...');
        const fsTest = await ChapterDownloads.testFileSystem();
        globalThis.__fileSystemTested = true;
        if (!fsTest) {
          console.error('❌ File system test failed - downloads may not work');
          setTasks((prev) =>
            prev.map((t) =>
              t.id === task.id
                ? { ...t, status: "error" as const, errorMessage: "File system test failed" }
                : t,
            ),
          );
          return;
        }
      }

      // Add to tracking refs BEFORE any async operations
      inflightRef.current.add(task.id);
      activePluginsRef.current.add(task.pluginId);

      let started = false;
      
      // CRITICAL FIX: Check if task still exists and is pending
      // Use a local variable to track if we should proceed
      let shouldProceed = false;
      
      setTasks((prev) => {
        const existing = prev.find((t) => t.id === task.id);
        console.log('🔍 Checking task status:', { 
          taskId: task.id, 
          currentStatus: existing?.status, 
          expectedStatus: 'pending' 
        });
        
        // CRITICAL FIX: Also allow 'downloading' status in case of retry
        if (!existing || (existing.status !== "pending" && existing.status !== "downloading")) {
          console.log('❌ Task not found or not pending/downloading:', { 
            found: !!existing, 
            status: existing?.status 
          });
          return prev;
        }
        
        // Check if already being processed by another instance
        if (existing.status === "downloading" && !inflightRef.current.has(task.id)) {
          console.log('❌ Task is downloading but not in inflightRef (stale state)');
          return prev;
        }
        
        started = true;
        shouldProceed = true;
        console.log('✅ Task status changed to downloading');
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

      if (!shouldProceed || !started) {
        console.log('❌ Task was not started - cleaning up refs');
        cleanupTaskRefs(task.id, task.pluginId);
        return;
      }

      const downloadLocation = settings.general.downloadLocation;
      let wroteFile = false;

      try {
        // Check cancellation immediately after state update
        if (canceledRef.current.has(task.id)) {
          console.log('❌ Task was cancelled before execution');
          return;
        }

        console.log('📖 Loading chapter content for download');
        const html = await loadChapterContent(
          task.chapterPath,
          task.pluginId,
          task.novelId,
          settings,
          () => novelsRef.current, // Pass getter function instead of snapshot
        );

        // Check cancellation after loading
        if (canceledRef.current.has(task.id)) {
          console.log('❌ Task was cancelled after loading content');
          return;
        }

        console.log('💾 Writing chapter to file system');
        console.log('📍 Download location:', downloadLocation);
        console.log('📁 File path:', ChapterDownloads.chapterFileUri(task.pluginId, task.novelId, task.chapterPath));
        
        await ChapterDownloads.writeChapterHtml(
          task.pluginId,
          task.novelId,
          task.chapterPath,
          html,
          downloadLocation,
        );
        wroteFile = true;
        console.log('✅ Chapter file written successfully');

        // Check cancellation after writing
        if (canceledRef.current.has(task.id)) {
          console.log('❌ Task was cancelled after writing file');
          return;
        }

        console.log('📚 Updating novel state');
        const novel = novelsRef.current.find((n) => n.id === task.novelId);
        if (novel) {
          console.log('Download completed, updating novel:', { 
            novelId: task.novelId, 
            chapterPath: task.chapterPath,
            currentDownloaded: novel.chapterDownloaded,
            newDownloaded: {
              ...(novel.chapterDownloaded || {}),
              [task.chapterPath]: true,
            }
          });
          updateNovel(task.novelId, {
            isDownloaded: true,
            chapterDownloaded: {
              ...(novel.chapterDownloaded || {}),
              [task.chapterPath]: true,
            },
          });
          console.log('✅ Novel state updated successfully');
        } else {
          console.log('❌ Novel not found for ID:', task.novelId);
        }

        // Final cancellation check before marking complete
        if (canceledRef.current.has(task.id)) return;

        console.log('✅ Marking task as completed');
        setTasks((prev) => {
          const updated = prev.map((t) =>
            t.id === task.id
              ? { ...t, status: "completed" as const, progress: 100 }
              : t,
          );
          console.log('🔄 Updated tasks state:', updated.map(t => ({ id: t.id, status: t.status })));
          return updated;
        });
        
        // Small delay to ensure state update propagates
        await new Promise(resolve => setTimeout(resolve, 100));
        console.log('✅ Task completion finalized');
        
      } catch (e: any) {
        console.log('❌ Download failed with error:', e);
        const message = e?.message ? String(e.message) : "Download failed.";
        console.log('📝 Error message:', message);
        
        // Only update to error if not canceled
        if (!canceledRef.current.has(task.id)) {
          setTasks((prev) =>
            prev.map((t) =>
              t.id === task.id
                ? { ...t, status: "error", errorMessage: message, progress: 0 }
                : t,
            ),
          );
        }
      } finally {
        console.log('🧹 Cleaning up task resources for:', task.id);
        
        // CRITICAL FIX: Always clean up refs, even on early returns
        cleanupTaskRefs(task.id, task.pluginId);

        const wasCanceled = canceledRef.current.has(task.id);
        
        if (wasCanceled) {
          console.log('🚫 Task was cancelled, cleaning up files');
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

          console.log('🗑️ Removing cancelled task from queue');
          setTasks((prev) => prev.filter((t) => t.id !== task.id));
        }
        
        // Always remove from canceled ref
        canceledRef.current.delete(task.id);
        console.log('✅ Task cleanup completed');
      }
    },
    [
      settings,
      updateNovel,
      cleanupTaskRefs,
    ],
  );

  useEffect(() => {
    if (!hydrated) return;
    if (paused) return;

    // Count tasks by status and plugin
    const pendingByPlugin = new Map<string, DownloadTask>();
    const downloadingByPlugin = new Set<string>();

    for (const t of tasks) {
      if (t.status === "pending") {
        const existing = pendingByPlugin.get(t.pluginId);
        if (!existing || t.createdAt < existing.createdAt) {
          pendingByPlugin.set(t.pluginId, t);
        }
      } else if (t.status === "downloading") {
        downloadingByPlugin.add(t.pluginId);
      }
    }

    console.log('📊 Queue analysis:', { 
      totalTasks: tasks.length,
      pendingTasks: tasks.filter(t => t.status === 'pending').length,
      downloadingTasks: tasks.filter(t => t.status === 'downloading').length,
      pendingByPlugin: Array.from(pendingByPlugin.entries()).map(([k, v]) => ({ pluginId: k, taskId: v.id })),
      downloadingPlugins: Array.from(downloadingByPlugin)
    });

    // Start pending tasks, but only if plugin isn't already downloading
    for (const [pluginId, task] of pendingByPlugin.entries()) {
      if (downloadingByPlugin.has(pluginId)) {
        console.log('⏸️ Skipping task for busy plugin:', { pluginId, taskId: task.id });
        continue;
      }
      
      // CRITICAL FIX: Also check inflightRef to prevent duplicate starts
      if (inflightRef.current.has(task.id)) {
        console.log('⏸️ Task already in inflightRef:', { taskId: task.id });
        continue;
      }
      
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