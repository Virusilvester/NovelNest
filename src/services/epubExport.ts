// src/services/epubExport.ts
import JSZip from "jszip";
import { load } from "cheerio-without-node-native";

export type EpubExportCoverImage = {
  base64: string;
  mediaType: string;
  extension: string;
};

export type EpubExportChapterInput = {
  title: string;
  html: string;
  sourceUrl?: string;
};

export type BuildEpubOptions = {
  uuid: string;
  title: string;
  author: string;
  language: string;
  description?: string;
  subject?: string;
  chapters: EpubExportChapterInput[];
  cover?: EpubExportCoverImage | null;
  createdAt?: Date;
  stylesheet?: string;
};

const zeroPad = (value: number, width: number) =>
  String(Math.max(0, Math.floor(value))).padStart(width, "0");

const escapeXml = (value: string) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const sanitizeFileName = (value: string) => {
  const raw = String(value || "book").trim();
  const cleaned = raw
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return cleaned || "book";
};

const stripScriptsAndUnsafe = ($: any) => {
  $("script, iframe, object, embed, form, input, button, textarea, select")
    .remove()
    .end();

  $("*").each((_i: number, el: any) => {
    const attribs = el?.attribs || {};
    for (const k of Object.keys(attribs)) {
      if (/^on/i.test(k)) $(el).removeAttr(k);
    }
  });

  $("img").each((_i: number, el: any) => {
    if (!$(el).attr("alt")) $(el).attr("alt", "image");
  });
};

const extractBodyOrRootHtml = ($: any) => {
  if ($("body").length > 0) return $("body").html() || "";
  return $.root().html() || "";
};

const sanitizeHtmlToXhtmlBody = (input: string) => {
  const $ = load(String(input || ""));
  stripScriptsAndUnsafe($);
  const inner = extractBodyOrRootHtml($);
  const $$ = load(String(inner || ""));
  stripScriptsAndUnsafe($$);
  return $$.xml();
};

const buildStylesheet = (custom?: string) => {
  if (custom && String(custom).trim()) return String(custom);
  return (
    "" +
    "body{margin:2%;font-family:serif;line-height:1.5;}\n" +
    "h1,h2,h3{margin:1.2em 0 0.6em 0;}\n" +
    "img{max-width:100%;height:auto;display:block;margin:1em auto;}\n" +
    "a{color:#0B0080;text-decoration:none;}\n" +
    "a:hover{text-decoration:underline;}\n" +
    "pre,code{white-space:pre-wrap;word-wrap:break-word;}\n"
  );
};

const buildXhtmlDocument = (opts: {
  title: string;
  lang: string;
  cssHref?: string;
  bodyInnerXhtml: string;
}) => {
  const cssLink = opts.cssHref
    ? `<link rel="stylesheet" type="text/css" href="${escapeXml(opts.cssHref)}" />`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${escapeXml(opts.lang)}" lang="${escapeXml(opts.lang)}">
  <head>
    <meta charset="utf-8" />
    <title>${escapeXml(opts.title)}</title>
    ${cssLink}
  </head>
  <body>
${opts.bodyInnerXhtml}
  </body>
</html>`;
};

const buildCoverXhtml = (opts: {
  title: string;
  lang: string;
  imageHref: string;
}) => {
  const body = `    <section epub:type="cover">
      <h1>${escapeXml(opts.title)}</h1>
      <img src="${escapeXml(opts.imageHref)}" alt="Cover" />
    </section>`;
  return buildXhtmlDocument({
    title: "Cover",
    lang: opts.lang,
    cssHref: "../Styles/style.css",
    bodyInnerXhtml: body,
  });
};

const buildChapterXhtml = (opts: {
  title: string;
  lang: string;
  bodyXhtml: string;
}) => {
  const body = `    <article>
      <h1>${escapeXml(opts.title)}</h1>
${opts.bodyXhtml}
    </article>`;
  return buildXhtmlDocument({
    title: opts.title,
    lang: opts.lang,
    cssHref: "../Styles/style.css",
    bodyInnerXhtml: body,
  });
};

const buildTocNcx = (opts: {
  uuid: string;
  title: string;
  lang: string;
  items: { title: string; href: string }[];
}) => {
  const navPoints = opts.items
    .map((it, index) => {
      const playOrder = index + 1;
      return `    <navPoint id="navPoint-${playOrder}" playOrder="${playOrder}">
      <navLabel><text>${escapeXml(it.title)}</text></navLabel>
      <content src="${escapeXml(it.href)}"/>
    </navPoint>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1" xml:lang="${escapeXml(opts.lang)}">
  <head>
    <meta name="dtb:uid" content="${escapeXml(opts.uuid)}"/>
    <meta name="dtb:depth" content="2"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${escapeXml(opts.title)}</text></docTitle>
  <navMap>
${navPoints}
  </navMap>
</ncx>`;
};

const buildNavXhtml = (opts: {
  lang: string;
  items: { title: string; href: string }[];
}) => {
  const li = opts.items
    .map(
      (it) =>
        `      <li><a href="${escapeXml(it.href)}">${escapeXml(it.title)}</a></li>`,
    )
    .join("\n");

  const body = `    <nav epub:type="toc" id="toc">
      <h1>Table of Contents</h1>
      <ol>
${li}
      </ol>
    </nav>`;

  return buildXhtmlDocument({
    title: "Table of Contents",
    lang: opts.lang,
    cssHref: "Styles/style.css",
    bodyInnerXhtml: body,
  });
};

const buildContentOpf = (opts: {
  uuid: string;
  title: string;
  author: string;
  lang: string;
  subject?: string;
  description?: string;
  createdAtIso: string;
  modifiedAtIso: string;
  coverImageId?: string;
  manifestItems: { id: string; href: string; mediaType: string; properties?: string }[];
  spineIds: string[];
  coverXhtmlHref?: string;
}) => {
  const metadataParts: string[] = [];
  metadataParts.push(`<dc:identifier id="BookId">${escapeXml(opts.uuid)}</dc:identifier>`);
  metadataParts.push(`<dc:title>${escapeXml(opts.title)}</dc:title>`);
  metadataParts.push(`<dc:language>${escapeXml(opts.lang)}</dc:language>`);
  metadataParts.push(`<dc:creator>${escapeXml(opts.author || "Unknown")}</dc:creator>`);
  metadataParts.push(`<dc:date>${escapeXml(opts.createdAtIso)}</dc:date>`);
  metadataParts.push(
    `<meta property="dcterms:modified">${escapeXml(opts.modifiedAtIso)}</meta>`,
  );
  if (opts.coverImageId) {
    metadataParts.push(
      `<meta name="cover" content="${escapeXml(opts.coverImageId)}"/>`,
    );
  }
  if (opts.subject && String(opts.subject).trim()) {
    metadataParts.push(`<dc:subject>${escapeXml(opts.subject)}</dc:subject>`);
  }
  if (opts.description && String(opts.description).trim()) {
    metadataParts.push(`<dc:description>${escapeXml(opts.description)}</dc:description>`);
  }

  const manifestXml = opts.manifestItems
    .map((i) => {
      const props = i.properties ? ` properties="${escapeXml(i.properties)}"` : "";
      return `    <item id="${escapeXml(i.id)}" href="${escapeXml(i.href)}" media-type="${escapeXml(i.mediaType)}"${props}/>`;
    })
    .join("\n");

  const spineXml = opts.spineIds
    .map((idref) => `    <itemref idref="${escapeXml(idref)}"/>`)
    .join("\n");

  const guideXml = opts.coverXhtmlHref
    ? `  <guide>
    <reference type="cover" title="Cover" href="${escapeXml(opts.coverXhtmlHref)}"/>
  </guide>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="3.0" xml:lang="${escapeXml(opts.lang)}">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    ${metadataParts.join("\n    ")}
  </metadata>
  <manifest>
${manifestXml}
  </manifest>
  <spine toc="ncx">
${spineXml}
  </spine>
${guideXml}
</package>`;
};

export const EpubExportService = {
  sanitizeHtmlToXhtmlBody,

  async buildEpubBase64(opts: BuildEpubOptions): Promise<{
    base64: string;
    fileName: string;
    mimeType: string;
  }> {
    const createdAt = opts.createdAt ?? new Date();
    const createdAtIso = createdAt.toISOString();
    const modifiedAtIso = new Date().toISOString().substring(0, 19) + "Z";

    const safeTitle = sanitizeFileName(opts.title);
    const fileName = `${safeTitle}-${createdAtIso.replace(/[:.]/g, "-")}.epub`;

    const lang = opts.language || "en";
    const zip = new JSZip();

    // Required files
    zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
    zip.file(
      "META-INF/container.xml",
      `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`,
    );

    // Styles
    zip.file("OEBPS/Styles/style.css", buildStylesheet(opts.stylesheet));

    // Content items
    const manifest: {
      id: string;
      href: string;
      mediaType: string;
      properties?: string;
    }[] = [];
    const spine: string[] = [];
    const tocItems: { title: string; href: string }[] = [];

    // toc files
    manifest.push({
      id: "ncx",
      href: "toc.ncx",
      mediaType: "application/x-dtbncx+xml",
    });
    manifest.push({
      id: "nav",
      href: "toc.xhtml",
      mediaType: "application/xhtml+xml",
      properties: "nav",
    });
    manifest.push({
      id: "css",
      href: "Styles/style.css",
      mediaType: "text/css",
    });

    // Optional cover
    if (opts.cover?.base64) {
      const ext = String(opts.cover.extension || "").toLowerCase() || "jpg";
      const mediaType = String(opts.cover.mediaType || "").trim() || "image/jpeg";
      const coverImageHref = `Images/cover.${ext}`;
      zip.file(`OEBPS/${coverImageHref}`, opts.cover.base64, { base64: true });

      const coverXhtmlHref = "Text/Cover.xhtml";
      zip.file(
        `OEBPS/${coverXhtmlHref}`,
        buildCoverXhtml({
          title: opts.title,
          lang,
          imageHref: `../${coverImageHref}`,
        }),
      );

      manifest.push({
        id: "cover-image",
        href: coverImageHref,
        mediaType,
        properties: "cover-image",
      });
      manifest.push({
        id: "cover",
        href: coverXhtmlHref,
        mediaType: "application/xhtml+xml",
      });
      spine.push("cover");
    }

    // Chapters
    const chapters = Array.isArray(opts.chapters) ? opts.chapters : [];
    chapters.forEach((ch, idx) => {
      const n = idx + 1;
      const id = `chap${zeroPad(n, 4)}`;
      const href = `Text/chapter${zeroPad(n, 4)}.xhtml`;
      const body = sanitizeHtmlToXhtmlBody(ch?.html || "");
      const title = String(ch?.title || `Chapter ${n}`);
      zip.file(`OEBPS/${href}`, buildChapterXhtml({ title, lang, bodyXhtml: body }));
      manifest.push({ id, href, mediaType: "application/xhtml+xml" });
      spine.push(id);
      tocItems.push({ title, href });
    });

    // TOC docs
    zip.file(
      "OEBPS/toc.ncx",
      buildTocNcx({ uuid: opts.uuid, title: opts.title, lang, items: tocItems }),
    );
    zip.file("OEBPS/toc.xhtml", buildNavXhtml({ lang, items: tocItems }));

    const coverGuideHref = opts.cover?.base64 ? "Text/Cover.xhtml" : undefined;
    zip.file(
      "OEBPS/content.opf",
      buildContentOpf({
        uuid: opts.uuid,
        title: opts.title,
        author: opts.author,
        lang,
        subject: opts.subject,
        description: opts.description,
        createdAtIso,
        modifiedAtIso,
        coverImageId: opts.cover?.base64 ? "cover-image" : undefined,
        manifestItems: manifest,
        spineIds: spine,
        coverXhtmlHref: coverGuideHref,
      }),
    );

    const base64 = await zip.generateAsync({
      type: "base64",
      compression: "DEFLATE",
      compressionOptions: { level: 9 },
    });

    return { base64, fileName, mimeType: "application/epub+zip" };
  },
};
