import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

const internalBaseDir = () => {
  const root = FileSystem.documentDirectory || "";
  return `${root}downloads/chapters/`;
};

const fnv1a32Hex = (input: string) => {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
};

const safeSegment = (segment: string) => encodeURIComponent(segment || "unknown");

const SAF = (FileSystem as any).StorageAccessFramework as
  | {
      requestDirectoryPermissionsAsync: () => Promise<{
        granted: boolean;
        directoryUri: string;
      }>;
      readDirectoryAsync: (dirUri: string) => Promise<string[]>;
      makeDirectoryAsync: (parentUri: string, dirName: string) => Promise<string>;
      createFileAsync: (dirUri: string, fileName: string, mimeType: string) => Promise<string>;
      deleteAsync?: (uri: string) => Promise<void>;
    }
  | undefined;

const isSafDirectoryUri = (uri: string | null | undefined) => {
  if (!uri) return false;
  if (Platform.OS !== "android") return false;
  if (!SAF) return false;
  return String(uri).startsWith("content://");
};

const sanitizeDirName = (name: string) => {
  const raw = String(name || "unknown");
  const cleaned = raw.replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, " ").trim();
  return cleaned || "unknown";
};

const extractSafChildName = (uri: string) => {
  const raw = String(uri || "");
  const idx = raw.lastIndexOf("%2F");
  if (idx >= 0) {
    try {
      return decodeURIComponent(raw.slice(idx + 3));
    } catch {
      return raw.slice(idx + 3);
    }
  }
  const tail = raw.split("/").pop() || "";
  try {
    return decodeURIComponent(tail);
  } catch {
    return tail;
  }
};

const safDirCache = new Map<string, string>();
const safFileCache = new Map<string, string>();

const safCacheKey = (rootUri: string, relPath: string) =>
  `${String(rootUri)}::${String(relPath)}`;

const findSafChildUri = async (parentUri: string, name: string) => {
  if (!SAF) return null;
  try {
    const children = await SAF.readDirectoryAsync(parentUri);
    return (
      children.find((u) => extractSafChildName(u) === name) ||
      children.find((u) => extractSafChildName(u).toLowerCase() === name.toLowerCase()) ||
      null
    );
  } catch {
    return null;
  }
};

const ensureSafDir = async (parentUri: string, dirName: string) => {
  if (!SAF) throw new Error("StorageAccessFramework not available.");
  try {
    return await SAF.makeDirectoryAsync(parentUri, dirName);
  } catch {
    const existing = await findSafChildUri(parentUri, dirName);
    if (existing) return existing;
    throw new Error(`Failed to create folder: ${dirName}`);
  }
};

const ensureSafDirChain = async (rootUri: string, segments: string[]) => {
  const safeSegments = segments.map(sanitizeDirName);
  let rel = "";
  let current = rootUri;
  for (const seg of safeSegments) {
    rel = rel ? `${rel}/${seg}` : seg;
    const key = safCacheKey(rootUri, rel);
    const cached = safDirCache.get(key);
    if (cached) {
      current = cached;
      continue;
    }
    const next = await ensureSafDir(current, seg);
    safDirCache.set(key, next);
    current = next;
  }
  return current;
};

const ensureSafFile = async (
  dirUri: string,
  fileName: string,
  mimeType: string,
  rootUriForCache: string,
  relPathForCache: string,
) => {
  if (!SAF) throw new Error("StorageAccessFramework not available.");
  const key = safCacheKey(rootUriForCache, relPathForCache);
  const cached = safFileCache.get(key);
  if (cached) return cached;

  try {
    const uri = await SAF.createFileAsync(dirUri, fileName, mimeType);
    safFileCache.set(key, uri);
    return uri;
  } catch {
    const existing = await findSafChildUri(dirUri, fileName);
    if (existing) {
      safFileCache.set(key, existing);
      return existing;
    }
    throw new Error(`Failed to create file: ${fileName}`);
  }
};

const findSafFile = async (
  dirUri: string,
  fileName: string,
  rootUriForCache: string,
  relPathForCache: string,
) => {
  const key = safCacheKey(rootUriForCache, relPathForCache);
  const cached = safFileCache.get(key);
  if (cached) return cached;

  const existing = await findSafChildUri(dirUri, fileName);
  if (existing) safFileCache.set(key, existing);
  return existing;
};

export const ChapterDownloads = {
  chapterDirUri(pluginId: string, novelId: string) {
    return `${internalBaseDir()}${safeSegment(pluginId)}/${safeSegment(novelId)}/`;
  },

  chapterFileUri(pluginId: string, novelId: string, chapterPath: string) {
    const fileName = `${fnv1a32Hex(String(chapterPath || ""))}.html`;
    return `${this.chapterDirUri(pluginId, novelId)}${fileName}`;
  },

  async ensureChapterDir(pluginId: string, novelId: string) {
    const dir = this.chapterDirUri(pluginId, novelId);
    try {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    } catch {
      // ignore: makeDirectoryAsync throws if it already exists on some platforms
    }
    return dir;
  },

  async existsFile(uri: string) {
    try {
      const info = await FileSystem.getInfoAsync(uri);
      return Boolean(info?.exists);
    } catch {
      return false;
    }
  },

  async isChapterDownloaded(
    pluginId: string,
    novelId: string,
    chapterPath: string,
    downloadLocation?: string | null,
  ) {
    const fileName = `${fnv1a32Hex(String(chapterPath || ""))}.html`;

    if (isSafDirectoryUri(downloadLocation)) {
      try {
        const dir = await ensureSafDirChain(downloadLocation as string, [
          "NovelNest",
          "chapters",
          pluginId,
          novelId,
        ]);
        const fileUri = await findSafFile(
          dir,
          fileName,
          downloadLocation as string,
          `NovelNest/chapters/${sanitizeDirName(pluginId)}/${sanitizeDirName(novelId)}/${fileName}`,
        );
        if (fileUri) return true;
      } catch {}
    }

    const internalUri = this.chapterFileUri(pluginId, novelId, chapterPath);
    return await this.existsFile(internalUri);
  },

  async readChapterHtml(
    pluginId: string,
    novelId: string,
    chapterPath: string,
    downloadLocation?: string | null,
  ) {
    const fileName = `${fnv1a32Hex(String(chapterPath || ""))}.html`;
    const internalUri = this.chapterFileUri(pluginId, novelId, chapterPath);

    if (isSafDirectoryUri(downloadLocation)) {
      try {
        const root = downloadLocation as string;
        const dir = await ensureSafDirChain(root, [
          "NovelNest",
          "chapters",
          pluginId,
          novelId,
        ]);
        const rel = `NovelNest/chapters/${sanitizeDirName(pluginId)}/${sanitizeDirName(novelId)}/${fileName}`;
        const fileUri = await findSafFile(dir, fileName, root, rel);
        if (fileUri) {
          return await FileSystem.readAsStringAsync(fileUri, {
            encoding: FileSystem.EncodingType.UTF8,
          });
        }
      } catch {}
    }

    const exists = await this.existsFile(internalUri);
    if (!exists) return null;
    try {
      return await FileSystem.readAsStringAsync(internalUri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
    } catch {
      return null;
    }
  },

  async writeChapterHtml(
    pluginId: string,
    novelId: string,
    chapterPath: string,
    html: string,
    downloadLocation?: string | null,
  ) {
    const fileName = `${fnv1a32Hex(String(chapterPath || ""))}.html`;
    const internalUri = this.chapterFileUri(pluginId, novelId, chapterPath);

    if (isSafDirectoryUri(downloadLocation)) {
      const root = downloadLocation as string;
      const dir = await ensureSafDirChain(root, [
        "NovelNest",
        "chapters",
        pluginId,
        novelId,
      ]);
      const rel = `NovelNest/chapters/${sanitizeDirName(pluginId)}/${sanitizeDirName(novelId)}/${fileName}`;
      const fileUri = await ensureSafFile(dir, fileName, "text/html", root, rel);
      await FileSystem.writeAsStringAsync(fileUri, html || "", {
        encoding: FileSystem.EncodingType.UTF8,
      });
      return fileUri;
    }

    await this.ensureChapterDir(pluginId, novelId);
    await FileSystem.writeAsStringAsync(internalUri, html || "", {
      encoding: FileSystem.EncodingType.UTF8,
    });
    return internalUri;
  },

  async deleteChapterHtml(
    pluginId: string,
    novelId: string,
    chapterPath: string,
    downloadLocation?: string | null,
  ) {
    const fileName = `${fnv1a32Hex(String(chapterPath || ""))}.html`;
    const internalUri = this.chapterFileUri(pluginId, novelId, chapterPath);

    if (isSafDirectoryUri(downloadLocation)) {
      try {
        const root = downloadLocation as string;
        const dir = await ensureSafDirChain(root, [
          "NovelNest",
          "chapters",
          pluginId,
          novelId,
        ]);
        const rel = `NovelNest/chapters/${sanitizeDirName(pluginId)}/${sanitizeDirName(novelId)}/${fileName}`;
        const fileUri = await findSafFile(dir, fileName, root, rel);
        if (fileUri) {
          if (SAF?.deleteAsync) await SAF.deleteAsync(fileUri);
          else await FileSystem.deleteAsync(fileUri, { idempotent: true });
        }
      } catch {
        // ignore
      }
    }

    try {
      await FileSystem.deleteAsync(internalUri, { idempotent: true });
    } catch {
      // ignore
    }
    return internalUri;
  },
};
