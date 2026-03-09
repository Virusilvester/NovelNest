// src/services/chapterDownloads.ts
import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

const internalBaseDir = () => {
  const root = FileSystem.documentDirectory || "";
  const baseDir = `${root}downloads/chapters/`;
  console.log("📁 File system info:", {
    documentDirectory: FileSystem.documentDirectory,
    cacheDirectory: FileSystem.cacheDirectory,
    baseDir,
    platform: Platform.OS,
  });
  return baseDir;
};

const fnv1a32Hex = (input: string) => {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
};

// Create a safe filename from chapter path
const createSafeChapterName = (chapterPath: string) => {
  // Extract the last part of the path for better readability
  const parts = chapterPath.split("/");
  const lastPart = parts[parts.length - 1] || chapterPath;

  // Remove file extension if present
  const nameWithoutExt = lastPart.replace(/\.[^/.]+$/, "");

  // Sanitize the name
  const sanitized = nameWithoutExt
    .replace(/[^a-zA-Z0-9-_]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 50); // Limit length

  return sanitized || "chapter";
};

const safeSegment = (segment: string) =>
  encodeURIComponent(segment || "unknown");

const SAF = (FileSystem as any).StorageAccessFramework as
  | {
      requestDirectoryPermissionsAsync: () => Promise<{
        granted: boolean;
        directoryUri: string;
      }>;
      readDirectoryAsync: (dirUri: string) => Promise<string[]>;
      makeDirectoryAsync: (
        parentUri: string,
        dirName: string,
      ) => Promise<string>;
      createFileAsync: (
        dirUri: string,
        fileName: string,
        mimeType: string,
      ) => Promise<string>;
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
  const cleaned = raw
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
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
      children.find(
        (u) => extractSafChildName(u).toLowerCase() === name.toLowerCase(),
      ) ||
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
  // Test function to diagnose file system issues
  async testFileSystem() {
    console.log("🧪 Testing file system capabilities...");

    try {
      // Test basic file operations
      const testDir = `${internalBaseDir()}test/`;
      console.log("📁 Creating test directory:", testDir);

      await FileSystem.makeDirectoryAsync(testDir, { intermediates: true });
      console.log("✅ Test directory created");

      const testFile = `${testDir}test.txt`;
      const testContent = "Hello from NovelNest download test!";

      console.log("📝 Writing test file:", testFile);
      await FileSystem.writeAsStringAsync(testFile, testContent);
      console.log("✅ Test file written");

      const readContent = await FileSystem.readAsStringAsync(testFile);
      console.log("✅ Test file read:", readContent);

      // Clean up
      await FileSystem.deleteAsync(testFile);
      await FileSystem.deleteAsync(testDir);
      console.log("✅ Test cleanup completed");

      return true;
    } catch (error) {
      console.error("❌ File system test failed:", error);
      return false;
    }
  },

  chapterDirUri(pluginId: string, novelId: string) {
    return `${internalBaseDir()}${safeSegment(pluginId)}/${safeSegment(novelId)}/`;
  },

  chapterFileUri(pluginId: string, novelId: string, chapterPath: string) {
    const hash = fnv1a32Hex(String(chapterPath || ""));
    const safeName = createSafeChapterName(chapterPath);
    const fileName = `${hash}_${safeName}.html`;
    return `${this.chapterDirUri(pluginId, novelId)}${fileName}`;
  },

  async ensureChapterDir(pluginId: string, novelId: string) {
    const dir = this.chapterDirUri(pluginId, novelId);
    console.log("📁 ensureChapterDir called:", { pluginId, novelId, dir });

    try {
      console.log("🔧 Attempting to create directory:", dir);
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      console.log("✅ Directory created successfully:", dir);
    } catch (error) {
      console.log("ℹ️ Directory creation failed (might already exist):", error);
      // ignore: makeDirectoryAsync throws if it already exists on some platforms
    }

    // Verify directory exists and is accessible
    try {
      console.log("🔍 Checking directory access...");
      const info = await FileSystem.getInfoAsync(dir);
      console.log("🔍 Directory verification:", {
        dir,
        exists: info.exists,
        isDirectory: info.isDirectory,
        uri: info.uri,
      });

      if (!info.exists) {
        console.error("❌ Directory does not exist after creation attempt!");
        throw new Error(`Directory creation failed: ${dir}`);
      }

      if (!info.isDirectory) {
        console.error("❌ Path exists but is not a directory!");
        throw new Error(`Path is not a directory: ${dir}`);
      }

      // Test write permissions by trying to list directory
      try {
        const contents = await FileSystem.readDirectoryAsync(dir);
        console.log(
          "✅ Directory is readable, contains:",
          contents.length,
          "items",
        );
      } catch (listError) {
        console.error("❌ Directory is not readable:", listError);
        throw new Error(`Directory is not readable: ${dir}`);
      }
    } catch (error) {
      console.error("❌ Directory verification failed:", error);
      throw error;
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
    const hash = fnv1a32Hex(String(chapterPath || ""));
    const safeName = createSafeChapterName(chapterPath);
    const fileName = `${hash}_${safeName}.html`;
    const internalUri = this.chapterFileUri(pluginId, novelId, chapterPath);

    console.log("📖 ChapterDownloads.readChapterHtml called:", {
      pluginId,
      novelId,
      chapterPath,
      hash,
      safeName,
      fileName,
      internalUri,
      downloadLocation,
    });

    if (isSafDirectoryUri(downloadLocation)) {
      console.log("📁 Trying SAF location first");
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
          console.log("✅ Found SAF file, reading:", fileUri);
          const content = await FileSystem.readAsStringAsync(fileUri, {
            encoding: FileSystem.EncodingType.UTF8,
          });
          console.log(
            "✅ SAF file read successfully, length:",
            content?.length || 0,
          );
          return content;
        } else {
          console.log("❌ SAF file not found");
        }
      } catch (error) {
        console.error("❌ SAF read failed:", error);
      }
    }

    console.log("📁 Trying internal storage location");
    const exists = await this.existsFile(internalUri);
    console.log("🔍 Internal file exists check:", {
      fileUri: internalUri,
      exists,
    });

    if (!exists) {
      console.log("❌ Internal file not found, returning null");
      return null;
    }

    try {
      console.log("📖 Reading internal file:", internalUri);
      const content = await FileSystem.readAsStringAsync(internalUri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      console.log(
        "✅ Internal file read successfully, length:",
        content?.length || 0,
      );
      return content;
    } catch (error) {
      console.error("❌ Internal file read failed:", error);
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
    const hash = fnv1a32Hex(String(chapterPath || ""));
    const safeName = createSafeChapterName(chapterPath);
    const fileName = `${hash}_${safeName}.html`;
    const internalUri = this.chapterFileUri(pluginId, novelId, chapterPath);

    console.log("📝 ChapterDownloads.writeChapterHtml called:", {
      pluginId,
      novelId,
      chapterPath,
      hash,
      safeName,
      fileName,
      internalUri,
      downloadLocation,
      htmlLength: html?.length || 0,
    });

    if (isSafDirectoryUri(downloadLocation)) {
      console.log("📁 Using SAF (Storage Access Framework) location");
      const root = downloadLocation as string;
      try {
        const dir = await ensureSafDirChain(root, [
          "NovelNest",
          "chapters",
          pluginId,
          novelId,
        ]);
        console.log("✅ SAF directory chain created:", dir);

        const rel = `NovelNest/chapters/${sanitizeDirName(pluginId)}/${sanitizeDirName(novelId)}/${fileName}`;
        const fileUri = await ensureSafFile(
          dir,
          fileName,
          "text/html",
          root,
          rel,
        );
        console.log("✅ SAF file created:", fileUri);

        await FileSystem.writeAsStringAsync(fileUri, html || "", {
          encoding: FileSystem.EncodingType.UTF8,
        });
        console.log("✅ SAF file written successfully");
        return fileUri;
      } catch (error) {
        console.error("❌ SAF write failed:", error);
        throw error;
      }
    }

    console.log("📁 Using internal storage location");
    try {
      await this.ensureChapterDir(pluginId, novelId);
      console.log("✅ Chapter directory ensured");

      console.log("💾 Writing to internal file:", internalUri);
      await FileSystem.writeAsStringAsync(internalUri, html || "", {
        encoding: FileSystem.EncodingType.UTF8,
      });
      console.log("✅ Internal file written successfully");

      // Verify file exists
      const exists = await this.existsFile(internalUri);
      console.log("🔍 File verification:", { fileUri: internalUri, exists });

      return internalUri;
    } catch (error) {
      console.error("❌ Internal storage write failed:", error);
      throw error;
    }
  },

  async deleteChapterHtml(
    pluginId: string,
    novelId: string,
    chapterPath: string,
    downloadLocation?: string | null,
  ) {
    const hash = fnv1a32Hex(String(chapterPath || ""));
    const safeName = createSafeChapterName(chapterPath);
    const fileName = `${hash}_${safeName}.html`;
    const internalUri = this.chapterFileUri(pluginId, novelId, chapterPath);

    console.log("🗑️ ChapterDownloads.deleteChapterHtml called:", {
      pluginId,
      novelId,
      chapterPath,
      hash,
      safeName,
      fileName,
      internalUri,
      downloadLocation,
    });

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
