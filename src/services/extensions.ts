import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import type { ExtensionRepoPlugin } from "../types";

const CACHE_PREFIX = "@novelnest_extensions_repo_cache:";
const PLUGINS_DIR_NAME = "extensions";

const hashString = (input: string): string => {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
};

const getCacheKey = (repoUrl: string): string => `${CACHE_PREFIX}${hashString(repoUrl)}`;

type RepoCache = {
  repoUrl: string;
  fetchedAt: string;
  plugins: ExtensionRepoPlugin[];
};

const isPlugin = (value: any): value is ExtensionRepoPlugin => {
  return (
    value &&
    typeof value === "object" &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.version === "string" &&
    typeof value.lang === "string" &&
    typeof value.site === "string" &&
    typeof value.url === "string" &&
    typeof value.iconUrl === "string"
  );
};

export const ExtensionsService = {
  normalizeRepoUrl: (url: string): string => url.trim(),

  loadCachedRepoIndex: async (
    repoUrl: string,
  ): Promise<RepoCache | null> => {
    const key = getCacheKey(repoUrl);
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as RepoCache;
      if (!parsed || parsed.repoUrl !== repoUrl || !Array.isArray(parsed.plugins))
        return null;
      return parsed;
    } catch {
      return null;
    }
  },

  fetchRepoIndex: async (repoUrl: string): Promise<RepoCache> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch(repoUrl, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch repo index (${response.status})`);
      }
      const data = await response.json();
      if (!Array.isArray(data)) {
        throw new Error("Invalid repo index format (expected array).");
      }
      const plugins = data.filter(isPlugin);
      if (plugins.length === 0) {
        throw new Error("Repo index returned zero valid plugins.");
      }

      const cache: RepoCache = {
        repoUrl,
        fetchedAt: new Date().toISOString(),
        plugins,
      };
      await AsyncStorage.setItem(getCacheKey(repoUrl), JSON.stringify(cache));
      return cache;
    } finally {
      clearTimeout(timeout);
    }
  },

  getPluginsDir: async (): Promise<string | null> => {
    const base = FileSystem.documentDirectory;
    if (!base) return null;
    const dir = `${base}${PLUGINS_DIR_NAME}/`;
    try {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    } catch {
      // ignore
    }
    return dir;
  },

  downloadPluginFile: async (
    pluginId: string,
    pluginUrl: string,
  ): Promise<string | null> => {
    const dir = await ExtensionsService.getPluginsDir();
    if (!dir) return null;
    const localUri = `${dir}${pluginId}.js`;
    await FileSystem.downloadAsync(pluginUrl, localUri);
    return localUri;
  },

  deletePluginFile: async (localUri?: string): Promise<void> => {
    if (!localUri) return;
    try {
      await FileSystem.deleteAsync(localUri, { idempotent: true });
    } catch {
      // ignore
    }
  },
};

