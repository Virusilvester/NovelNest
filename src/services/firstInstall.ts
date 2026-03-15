import AsyncStorage from "@react-native-async-storage/async-storage";
import { PermissionsAndroid, Platform } from "react-native";
import { DatabaseService } from "./database";

const FIRST_INSTALL_KEY = "@novelnest_first_install_v1";

const getAndroidApiLevel = () => {
  const v = Platform.Version as unknown;
  if (typeof v === "number") return v;
  const parsed = Number(v);
  return Number.isFinite(parsed) ? parsed : 0;
};

async function ensurePostNotificationsPermissionOnAndroid(): Promise<void> {
  if (Platform.OS !== "android") return;
  if (getAndroidApiLevel() < 33) return;

  try {
    const perm = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
    const has = await PermissionsAndroid.check(perm);
    if (has) return;
    await PermissionsAndroid.request(perm);
  } catch {
    // Ignore: permission prompts can fail on some OEMs / older API levels.
  }
}

export const FirstInstallService = {
  async runOnce(): Promise<boolean> {
    try {
      const done = await AsyncStorage.getItem(FIRST_INSTALL_KEY);
      if (done === "1") return false;

      // Core bootstrap work for a fresh install.
      await DatabaseService.initialize();
      await ensurePostNotificationsPermissionOnAndroid();

      await AsyncStorage.setItem(FIRST_INSTALL_KEY, "1");
      return true;
    } catch (e) {
      // Don't block app startup if first-install work fails.
      console.warn("FirstInstallService failed:", e);
      return false;
    }
  },
};

