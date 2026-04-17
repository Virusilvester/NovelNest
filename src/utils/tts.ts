const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

const decodeHtmlEntities = (input: string): string => {
  if (!input) return "";
  return input
    .replace(/&(#\d+|#x[0-9a-fA-F]+|\w+);/g, (m, body: string) => {
      const b = String(body || "");
      if (b.startsWith("#x") || b.startsWith("#X")) {
        const n = Number.parseInt(b.slice(2), 16);
        if (Number.isFinite(n) && n > 0) return String.fromCodePoint(n);
        return m;
      }
      if (b.startsWith("#")) {
        const n = Number.parseInt(b.slice(1), 10);
        if (Number.isFinite(n) && n > 0) return String.fromCodePoint(n);
        return m;
      }
      const named = NAMED_ENTITIES[b.toLowerCase()];
      return named != null ? named : m;
    })
    .replace(/\u00A0/g, " ");
};

export const htmlToPlainText = (html: string): string => {
  const raw = String(html || "");
  if (!raw.trim()) return "";

  // Replace common block-level boundaries with newlines before stripping tags.
  const withBreaks = raw
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/\s*(p|div|h[1-6]|li|tr)\s*>/gi, "\n")
    .replace(/<\s*li\s*>/gi, "\n- ")
    .replace(/<\/\s*(ul|ol)\s*>/gi, "\n");

  const noScripts = withBreaks
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, "");

  const noTags = noScripts.replace(/<[^>]*>/g, " ");
  const decoded = decodeHtmlEntities(noTags);

  // Normalize whitespace but keep paragraph breaks.
  const normalized = decoded
    .replace(/\r\n/g, "\n")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return normalized;
};

const splitLongSentence = (sentence: string, maxLen: number): string[] => {
  const s = sentence.trim();
  if (s.length <= maxLen) return [s];
  const words = s.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  let cur = "";
  for (const w of words) {
    if (!cur) {
      cur = w;
      continue;
    }
    if (cur.length + 1 + w.length <= maxLen) {
      cur += ` ${w}`;
      continue;
    }
    chunks.push(cur);
    cur = w;
  }
  if (cur) chunks.push(cur);
  return chunks;
};

export const splitTextForSpeech = (text: string, maxLen: number): string[] => {
  const cleaned = String(text || "").replace(/\s+\n/g, "\n").trim();
  if (!cleaned) return [];

  const cap = Math.max(200, Math.floor(maxLen || 0));

  // Naive sentence splitting; good enough for chapter text and avoids lookbehind.
  const sentences =
    cleaned.match(/[^.!?\n]+[.!?]+|[^.!?\n]+|\n+/g)?.map((s) => s.trim()) ||
    [];

  const out: string[] = [];
  let cur = "";

  const flush = () => {
    const v = cur.trim();
    if (v) out.push(v);
    cur = "";
  };

  for (const part of sentences) {
    const p = part.trim();
    if (!p) continue;
    if (p === "\n" || p === "\n\n") {
      // Paragraph break: prefer to flush for a natural pause.
      flush();
      continue;
    }

    if (!cur) {
      if (p.length <= cap) {
        cur = p;
      } else {
        out.push(...splitLongSentence(p, cap));
      }
      continue;
    }

    if (cur.length + 1 + p.length <= cap) {
      cur += ` ${p}`;
      continue;
    }

    flush();
    if (p.length <= cap) {
      cur = p;
    } else {
      out.push(...splitLongSentence(p, cap));
    }
  }

  flush();

  return out;
};

