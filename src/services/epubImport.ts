// src/services/epubImport.ts
import { load } from "cheerio-without-node-native";
import * as FileSystem from "expo-file-system/legacy";
import JSZip from "jszip";
import type { CachedPluginNovelDetail, Novel } from "../types";
import { ChapterDownloads } from "./chapterDownloads";

type Progress =
  | { stage: "reading"; text: string }
  | { stage: "parsing"; text: string }
  | { stage: "chapters"; current: number; total: number; text: string }
  | { stage: "finalizing"; text: string };

type ImportOptions = {
  uri: string;
  filename: string;
  defaultCategoryId: string;
  languageFallback?: string;
  onProgress?: (p: Progress) => void;
};

type ManifestItem = {
  id: string;
  href: string;
  mediaType: string;
  properties?: string;
};

const LOCAL_PLUGIN_ID = "local";

const isAbsoluteUrl = (url: string) => /^https?:\/\//i.test(String(url || ""));

const fnv1a32 = (input: string) => {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const normalizeZipPath = (path: string) => {
  const raw = String(path || "").replace(/\\/g, "/").replace(/^\/+/, "");
  const parts = raw.split("/").filter((p) => p.length > 0);
  const out: string[] = [];
  for (const part of parts) {
    if (part === ".") continue;
    if (part === "..") {
      out.pop();
      continue;
    }
    out.push(part);
  }
  return out.join("/");
};

const dirname = (p: string) => {
  const path = normalizeZipPath(p);
  const idx = path.lastIndexOf("/");
  return idx >= 0 ? path.slice(0, idx + 1) : "";
};

const splitHref = (href: string) => {
  const raw = String(href || "");
  const hashIdx = raw.indexOf("#");
  const qIdx = raw.indexOf("?");
  const cut =
    hashIdx >= 0 && qIdx >= 0 ? Math.min(hashIdx, qIdx) : Math.max(hashIdx, qIdx);
  const base = cut >= 0 ? raw.slice(0, cut) : raw;
  const suffix = cut >= 0 ? raw.slice(cut) : "";
  return { base, suffix };
};

const resolveRelativeZipPath = (fromFilePath: string, href: string) => {
  const rawHref = String(href || "").trim();
  if (!rawHref) return null;
  if (rawHref.startsWith("#")) return null;
  if (isAbsoluteUrl(rawHref)) return null;
  if (/^(data|mailto|tel):/i.test(rawHref)) return null;

  const { base, suffix } = splitHref(rawHref);
  if (!base) return null;

  const baseDir = dirname(fromFilePath);
  const joined = normalizeZipPath(`${baseDir}${base}`);
  if (!joined) return null;
  return { path: joined, suffix };
};

const guessMimeTypeFromPath = (path: string) => {
  const lower = String(path || "").toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".css")) return "text/css";
  if (lower.endsWith(".xhtml")) return "application/xhtml+xml";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html";
  return "application/octet-stream";
};

const safeTitleFallback = (filename: string) => {
  const base = String(filename || "")
    .split(/[/\\]/g)
    .pop();
  const trimmed = String(base || "").replace(/\.epub$/i, "").trim();
  return trimmed || "Untitled";
};

const pickFirstText = (values: string[]) =>
  values.map((v) => String(v || "").trim()).find((v) => v.length > 0) || "";

const parseOpf = (opfXml: string) => {
  const $ = load(String(opfXml || ""), { xmlMode: true });

  const title = pickFirstText([$(`dc\\:title`).first().text()]);
  const language = pickFirstText([$(`dc\\:language`).first().text()]);

  const creators: string[] = [];
  $(`dc\\:creator`).each((_i: number, el: any) => {
    const t = String($(el).text() || "").trim();
    if (t) creators.push(t);
  });

  const descriptions: string[] = [];
  $(`dc\\:description`).each((_i: number, el: any) => {
    const t = String($(el).text() || "").trim();
    if (t) descriptions.push(t);
  });

  const subjects: string[] = [];
  $(`dc\\:subject`).each((_i: number, el: any) => {
    const t = String($(el).text() || "").trim();
    if (t) subjects.push(t);
  });

  const coverId =
    $(`meta[name="cover"]`).attr("content") ||
    $(`meta[name="cover-image"]`).attr("content") ||
    undefined;

  const manifestItems: ManifestItem[] = [];
  $(`manifest > item`).each((_i: number, el: any) => {
    const id = String($(el).attr("id") || "").trim();
    const href = String($(el).attr("href") || "").trim();
    const mediaType = String($(el).attr("media-type") || "").trim();
    const properties = String($(el).attr("properties") || "").trim() || undefined;
    if (!id || !href || !mediaType) return;
    manifestItems.push({ id, href, mediaType, properties });
  });

  const spineIds: string[] = [];
  $(`spine > itemref`).each((_i: number, el: any) => {
    const idref = String($(el).attr("idref") || "").trim();
    if (!idref) return;
    spineIds.push(idref);
  });

  return {
    title,
    language,
    creators,
    description: descriptions.join("\n\n"),
    subjects,
    coverId,
    manifestItems,
    spineIds,
  };
};

const parseContainerRootfilePath = (xml: string) => {
  const $ = load(String(xml || ""), { xmlMode: true });
  const full = String($("rootfile").attr("full-path") || "").trim();
  return full || null;
};

const extractChapterTitle = (html: string) => {
  const $ = load(String(html || ""), { xmlMode: true });
  const t = String($("title").first().text() || "").trim();
  if (t) return t;
  const h1 = String($("h1").first().text() || "").trim();
  return h1;
};

const inlineChapterImages = async (opts: {
  zip: JSZip;
  html: string;
  chapterZipPath: string;
  mediaTypeByZipPath: Map<string, string>;
  base64Cache: Map<string, string>;
  onMissingAsset?: (zipPath: string) => void;
}) => {
  const $ = load(String(opts.html || ""), { xmlMode: true });

  const replaceWithDataUri = async (
    attrValue: string,
    setAttr: (next: string) => void,
  ) => {
    const resolved = resolveRelativeZipPath(opts.chapterZipPath, attrValue);
    if (!resolved) return;
    const file = opts.zip.file(resolved.path);
    if (!file) {
      opts.onMissingAsset?.(resolved.path);
      return;
    }

    const mime =
      opts.mediaTypeByZipPath.get(resolved.path) ||
      guessMimeTypeFromPath(resolved.path);
    if (!mime.startsWith("image/")) return;
    if (mime === "image/webp") return;

    const cached = opts.base64Cache.get(resolved.path);
    const base64 = cached || (await file.async("base64"));
    if (!cached) opts.base64Cache.set(resolved.path, base64);

    setAttr(`data:${mime};base64,${base64}${resolved.suffix || ""}`);
  };

  const imgNodes = $("img").toArray();
  for (const el of imgNodes) {
    const src = String($(el).attr("src") || "");
    // eslint-disable-next-line no-await-in-loop
    await replaceWithDataUri(src, (next) => $(el).attr("src", next));
  }

  const svgImageNodes = $("image").toArray();
  for (const el of svgImageNodes) {
    const href = String($(el).attr("href") || "");
    const xlinkHref = String($(el).attr("xlink:href") || "");
    if (href) {
      // eslint-disable-next-line no-await-in-loop
      await replaceWithDataUri(href, (next) => $(el).attr("href", next));
    } else if (xlinkHref) {
      // eslint-disable-next-line no-await-in-loop
      await replaceWithDataUri(xlinkHref, (next) =>
        $(el).attr("xlink:href", next),
      );
    }
  }

  return $.xml();
};

export const EpubImportService = {
  async importFromUri(opts: ImportOptions): Promise<Novel> {
    const onProgress = opts.onProgress;
    onProgress?.({ stage: "reading", text: "Reading EPUB file..." });

    const epubBase64 = await FileSystem.readAsStringAsync(opts.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    onProgress?.({ stage: "parsing", text: "Parsing EPUB structure..." });
    const zip = await JSZip.loadAsync(epubBase64, { base64: true });

    const containerFile = zip.file("META-INF/container.xml");
    if (!containerFile) throw new Error("Invalid EPUB: missing container.xml");
    const containerXml = await containerFile.async("text");
    const rootfilePathRaw = parseContainerRootfilePath(containerXml);
    if (!rootfilePathRaw) throw new Error("Invalid EPUB: missing rootfile path");
    const opfPath = normalizeZipPath(rootfilePathRaw);
    const opfFile = zip.file(opfPath);
    if (!opfFile) throw new Error(`Invalid EPUB: missing OPF (${opfPath})`);

    const opfXml = await opfFile.async("text");
    const opfDir = dirname(opfPath);
    const parsed = parseOpf(opfXml);

    const now = Date.now();
    const novelId = String(now);

    const title = parsed.title || safeTitleFallback(opts.filename);
    const author = pickFirstText([parsed.creators[0] || "Unknown"]);
    const language = parsed.language || opts.languageFallback || "en";
    const summary = parsed.description || "";
    const genres = parsed.subjects
      .flatMap((s) =>
        String(s || "")
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      )
      .slice(0, 50);

    const manifestById = new Map(parsed.manifestItems.map((i) => [i.id, i]));
    const zipPathById = new Map<string, string>();
    const mediaTypeByZipPath = new Map<string, string>();
    for (const it of parsed.manifestItems) {
      const zipPath = normalizeZipPath(`${opfDir}${it.href}`);
      zipPathById.set(it.id, zipPath);
      mediaTypeByZipPath.set(zipPath, it.mediaType);
    }

    const coverItem = (() => {
      if (parsed.coverId) {
        const byMeta = manifestById.get(parsed.coverId);
        if (byMeta && String(byMeta.mediaType || "").startsWith("image/"))
          return byMeta;
      }
      const byProp = parsed.manifestItems.find((i) =>
        String(i.properties || "").includes("cover-image"),
      );
      if (byProp) return byProp;
      const byId = parsed.manifestItems.find(
        (i) =>
          String(i.id || "").toLowerCase().includes("cover") &&
          String(i.mediaType || "").startsWith("image/"),
      );
      if (byId) return byId;
      return parsed.manifestItems.find(
        (i) =>
          String(i.href || "").toLowerCase().includes("cover") &&
          String(i.mediaType || "").startsWith("image/"),
      );
    })();

    const coverUrl = await (async () => {
      if (!coverItem) return "";
      const coverZipPath = normalizeZipPath(`${opfDir}${coverItem.href}`);
      const coverFile = zip.file(coverZipPath);
      if (!coverFile) return "";
      const mime = coverItem.mediaType || guessMimeTypeFromPath(coverZipPath);
      if (!mime.startsWith("image/")) return "";
      if (mime === "image/webp") return "";

      const base64 = await coverFile.async("base64");
      const ext =
        mime === "image/png"
          ? "png"
          : mime === "image/gif"
            ? "gif"
            : mime === "image/svg+xml"
              ? "svg"
              : "jpg";

      const baseDir = FileSystem.documentDirectory;
      if (!baseDir) return "";
      const novelDir = `${baseDir}local/${novelId}/`;
      await FileSystem.makeDirectoryAsync(novelDir, { intermediates: true });
      const fileUri = `${novelDir}cover.${ext}`;
      await FileSystem.writeAsStringAsync(fileUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return fileUri;
    })();

    const spine = parsed.spineIds
      .map((idref) => manifestById.get(idref))
      .filter(Boolean) as ManifestItem[];

    const chapterItems = spine.filter((it) => {
      const mt = String(it.mediaType || "");
      if (mt !== "application/xhtml+xml" && mt !== "text/html") return false;
      if (String(it.properties || "").includes("nav")) return false;
      return true;
    });

    if (chapterItems.length === 0) {
      throw new Error("No readable chapters found in this EPUB.");
    }

    const base64Cache = new Map<string, string>();
    const importedChapters: { name: string; path: string }[] = [];
    const chapterDownloaded: Record<string, boolean> = {};
    let missingAssets = 0;

    for (let i = 0; i < chapterItems.length; i++) {
      const item = chapterItems[i];
      const zipPath = normalizeZipPath(`${opfDir}${item.href}`);
      const file = zip.file(zipPath);
      if (!file) continue;

      onProgress?.({
        stage: "chapters",
        current: i + 1,
        total: chapterItems.length,
        text: `Importing ${i + 1}/${chapterItems.length}`,
      });

      // eslint-disable-next-line no-await-in-loop
      const html = await file.async("text");
      const titleFromDoc = extractChapterTitle(html);
      const chapterTitle = titleFromDoc || `Chapter ${i + 1}`;

      // eslint-disable-next-line no-await-in-loop
      const inlined = await inlineChapterImages({
        zip,
        html,
        chapterZipPath: zipPath,
        mediaTypeByZipPath,
        base64Cache,
        onMissingAsset: () => {
          missingAssets += 1;
        },
      });

      // eslint-disable-next-line no-await-in-loop
      await ChapterDownloads.writeChapterHtml(
        LOCAL_PLUGIN_ID,
        novelId,
        zipPath,
        inlined,
        null,
      );

      importedChapters.push({ name: chapterTitle, path: zipPath });
      chapterDownloaded[zipPath] = true;
    }

    onProgress?.({ stage: "finalizing", text: "Finalizing..." });

    const totalChapters = importedChapters.length;
    const pluginCache: CachedPluginNovelDetail = {
      signature: `local:${fnv1a32(`${title}:${now}`)}`,
      cachedAt: now,
      detail: {
        name: title,
        author,
        cover: coverUrl || undefined,
        summary,
        genres,
        status: "completed",
        totalChapters,
        path: undefined,
      },
      chapters: importedChapters.map((c, idx) => ({
        name: c.name,
        path: c.path,
        chapterNumber: idx + 1,
      })),
      chaptersPage: 1,
      chaptersHasMore: false,
    };

    const novel: Novel = {
      id: novelId,
      title,
      author,
      coverUrl: coverUrl || "https://via.placeholder.com/300x450",
      status: "completed",
      source: "Local",
      summary,
      genres,
      totalChapters,
      unreadChapters: totalChapters,
      lastReadChapter: 0,
      lastReadDate: undefined,
      isDownloaded: true,
      isInLibrary: true,
      categoryId: opts.defaultCategoryId,
      pluginId: LOCAL_PLUGIN_ID,
      pluginCache,
      chapterDownloaded,
    };

    if (missingAssets > 0) {
      // No-op for now: callers can surface a generic note if desired.
    }

    return novel;
  },
};
