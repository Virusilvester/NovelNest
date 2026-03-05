import * as FileSystem from "expo-file-system/legacy";

const baseDir = () => {
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

export const ChapterDownloads = {
  chapterDirUri(pluginId: string, novelId: string) {
    return `${baseDir()}${safeSegment(pluginId)}/${safeSegment(novelId)}/`;
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

  async isChapterDownloaded(pluginId: string, novelId: string, chapterPath: string) {
    const uri = this.chapterFileUri(pluginId, novelId, chapterPath);
    return await this.existsFile(uri);
  },

  async readChapterHtml(pluginId: string, novelId: string, chapterPath: string) {
    const uri = this.chapterFileUri(pluginId, novelId, chapterPath);
    const exists = await this.existsFile(uri);
    if (!exists) return null;
    try {
      return await FileSystem.readAsStringAsync(uri, {
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
  ) {
    await this.ensureChapterDir(pluginId, novelId);
    const uri = this.chapterFileUri(pluginId, novelId, chapterPath);
    await FileSystem.writeAsStringAsync(uri, html || "", {
      encoding: FileSystem.EncodingType.UTF8,
    });
    return uri;
  },

  async deleteChapterHtml(pluginId: string, novelId: string, chapterPath: string) {
    const uri = this.chapterFileUri(pluginId, novelId, chapterPath);
    try {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    } catch {
      // ignore
    }
    return uri;
  },
};

