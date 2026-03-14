// src/services/androidProgressNotifications.ts
import { PermissionsAndroid, Platform } from "react-native";

export type ProgressNotificationTask = {
  title: string;
  body?: string;
  progress?: {
    current?: number;
    max?: number;
    indeterminate?: boolean;
  };
};

type InternalTask = ProgressNotificationTask & {
  startedAt: number;
  updatedAt: number;
};

type NotifeeModule = typeof import("@notifee/react-native");

const NOTIFICATION_ID = "novelnest-progress";
const CHANNEL_ID = "novelnest-progress";
const CHANNEL_NAME = "Progress";

const MIN_UPDATE_INTERVAL_MS = 1000;
const PRIORITY_KEYS = ["epubImport", "epubExport", "updates", "downloads"] as const;

const tasks = new Map<string, InternalTask>();

let lastFlushAt = 0;
let flushTimer: any = null;
let cachedNotifeeModule: NotifeeModule | null = null;
let permissionCache: boolean | null = null;
let channelReady = false;

const nowMs = () => Date.now();

const isAndroid = () => Platform.OS === "android";

const getAndroidApiLevel = () => {
  const v = Platform.Version as unknown;
  if (typeof v === "number") return v;
  const parsed = Number(v);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getNotifeeModule = async (): Promise<NotifeeModule | null> => {
  if (!isAndroid()) return null;
  if (cachedNotifeeModule) return cachedNotifeeModule;
  try {
    cachedNotifeeModule = await import("@notifee/react-native");
    return cachedNotifeeModule;
  } catch (e) {
    console.warn("Notifee failed to load:", e);
    return null;
  }
};

const ensurePostNotificationsPermission = async (): Promise<boolean> => {
  if (!isAndroid()) return false;
  const api = getAndroidApiLevel();
  if (api < 33) return true;
  if (permissionCache != null) return permissionCache;

  try {
    const perm = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
    const has = await PermissionsAndroid.check(perm);
    if (has) {
      permissionCache = true;
      return true;
    }
    const res = await PermissionsAndroid.request(perm);
    permissionCache = res === PermissionsAndroid.RESULTS.GRANTED;
    return permissionCache;
  } catch (e) {
    console.warn("Notification permission check failed:", e);
    permissionCache = false;
    return false;
  }
};

const ensureChannel = async (mod: NotifeeModule) => {
  if (channelReady) return;
  const notifee = mod.default;
  try {
    await notifee.createChannel({
      id: CHANNEL_ID,
      name: CHANNEL_NAME,
      importance: mod.AndroidImportance.LOW,
    });
    channelReady = true;
  } catch (e) {
    console.warn("Failed to create notification channel:", e);
  }
};

const pickActiveTask = (): { key: string; task: InternalTask } | null => {
  if (tasks.size === 0) return null;

  for (const key of PRIORITY_KEYS) {
    const task = tasks.get(key);
    if (task) return { key, task };
  }

  let chosen: { key: string; task: InternalTask } | null = null;
  for (const [key, task] of tasks.entries()) {
    if (!chosen || task.startedAt < chosen.task.startedAt) {
      chosen = { key, task };
    }
  }
  return chosen;
};

const flush = async () => {
  flushTimer = null;
  if (!isAndroid()) return;

  const mod = await getNotifeeModule();
  if (!mod) return;
  const notifee = mod.default;

  const active = pickActiveTask();
  if (!active) {
    try {
      await notifee.cancelNotification(NOTIFICATION_ID);
    } catch {
      // ignore
    } finally {
      lastFlushAt = nowMs();
    }
    return;
  }

  const allowed = await ensurePostNotificationsPermission();
  if (!allowed) {
    try {
      await notifee.cancelNotification(NOTIFICATION_ID);
    } catch {
      // ignore
    } finally {
      lastFlushAt = nowMs();
    }
    return;
  }

  await ensureChannel(mod);

  const p = active.task.progress;
  const hasNumbers =
    typeof p?.current === "number" && typeof p?.max === "number" && p.max > 0;
  const indeterminate = p?.indeterminate ?? !hasNumbers;
  const max = hasNumbers ? Math.max(1, Math.floor(p!.max!)) : 100;
  const current = hasNumbers ? Math.max(0, Math.floor(p!.current!)) : 0;

  try {
    await notifee.displayNotification({
      id: NOTIFICATION_ID,
      title: String(active.task.title || "Working…"),
      body: active.task.body ? String(active.task.body) : undefined,
      android: {
        channelId: CHANNEL_ID,
        smallIcon: "ic_launcher",
        ongoing: true,
        autoCancel: false,
        onlyAlertOnce: true,
        color: "#00adb5",
        pressAction: { id: "default" },
        progress: {
          indeterminate,
          max,
          current,
        },
      },
    });
  } catch (e) {
    console.warn("Failed to display notification:", e);
  } finally {
    lastFlushAt = nowMs();
  }
};

const scheduleFlush = () => {
  if (!isAndroid()) return;
  if (flushTimer != null) return;
  const now = nowMs();
  const elapsed = now - lastFlushAt;
  const delay = elapsed >= MIN_UPDATE_INTERVAL_MS ? 0 : MIN_UPDATE_INTERVAL_MS - elapsed;
  flushTimer = setTimeout(() => void flush(), delay);
};

export const AndroidProgressNotifications = {
  setTask(key: string, data: ProgressNotificationTask) {
    if (!key) return;
    const time = nowMs();
    const existing = tasks.get(key);
    tasks.set(key, {
      ...data,
      startedAt: existing?.startedAt ?? time,
      updatedAt: time,
    });
    scheduleFlush();
  },

  clearTask(key: string) {
    if (!key) return;
    if (!tasks.has(key)) return;
    tasks.delete(key);
    scheduleFlush();
  },

  clearAll() {
    if (tasks.size === 0) return;
    tasks.clear();
    scheduleFlush();
  },

  async dismissStaleNotification() {
    if (!isAndroid()) return;
    const mod = await getNotifeeModule();
    if (!mod) return;
    try {
      await mod.default.cancelNotification(NOTIFICATION_ID);
    } catch {
      // ignore
    }
  },
};

