import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useKeepAwake } from "expo-keep-awake";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Linking,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { WebViewMessageEvent } from "react-native-webview";
import WebView from "react-native-webview";
import { useSettings } from "../../context/SettingsContext";
import { useTheme } from "../../context/ThemeContext";
import { PopupMenu } from "../common/PopupMenu";
import { ChapterDrawer, type ReaderChapterItem } from "./ChapterDrawer";

type Props = {
  initialChapterPath: string;
  initialChapterTitle?: string;
  chapters: ReaderChapterItem[];
  loadChapterHtml: (chapterPath: string) => Promise<string>;
  baseUrl?: string;
  onBack?: () => void;
  onOpenWeb?: (chapterPath: string) => void;
  onChapterChange?: (chapter: ReaderChapterItem, index: number) => void;
  onChapterRead?: (chapter: ReaderChapterItem, index: number) => void;
  extraMenuItems?: {
    id: string;
    label: string;
    onPress: () => void;
    isDestructive?: boolean;
  }[];
};

type WebMsg =
  | { type: "toggle" }
  | { type: "scroll"; progress: number };

const isAbsoluteUrl = (url: string) => {
  if (!url) return false;
  if (url.startsWith("//")) return true;
  return /^https?:\/\//i.test(url);
};

const stripScripts = (input: string) =>
  input
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object\b[\s\S]*?<\/object>/gi, "")
    .replace(/<embed\b[\s\S]*?<\/embed>/gi, "");

const stripEventHandlers = (input: string) =>
  input.replace(/\son\w+=(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");

const extractBodyContent = (input: string) => {
  const match = input.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return match ? match[1] : input;
};

const buildReaderHtml = (opts: {
  rawHtml: string;
  backgroundColor: string;
  textColor: string;
  fontSize: number;
  lineHeight: number;
  padding: number;
  fontFamily: string;
  textAlign: "left" | "center" | "justify";
  linkColor: string;
  isDark: boolean;
}) => {
  const safeBody = stripEventHandlers(stripScripts(extractBodyContent(opts.rawHtml || "")));

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0, maximum-scale=1.0"
    />
    <style>
      :root { color-scheme: ${opts.isDark ? "dark" : "light"}; }
      html, body { width: 100%; height: 100%; }
      body {
        margin: 0;
        padding: ${Math.max(0, opts.padding)}px;
        background: ${opts.backgroundColor};
        color: ${opts.textColor};
        font-size: ${Math.max(10, opts.fontSize)}px;
        line-height: ${Math.max(1, opts.lineHeight)};
        font-family: ${opts.fontFamily || "system-ui"}, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
        text-align: ${opts.textAlign};
        -webkit-text-size-adjust: 100%;
      }
      img, video { max-width: 100%; height: auto; }
      pre, code { white-space: pre-wrap; word-wrap: break-word; }
      a { color: ${opts.linkColor}; }
      table { max-width: 100%; }
    </style>
  </head>
  <body>
    <article id="novelnest-reader">${safeBody}</article>
  </body>
</html>`;
};

export const ChapterReader: React.FC<Props> = ({
  initialChapterPath,
  initialChapterTitle,
  chapters,
  loadChapterHtml,
  baseUrl,
  onBack,
  onOpenWeb,
  onChapterChange,
  onChapterRead,
  extraMenuItems,
}) => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { settings } = useSettings();
  const insets = useSafeAreaInsets();

  const KeepAwake = () => {
    useKeepAwake();
    return null;
  };

  const webViewRef = useRef<any>(null);
  const chapterHtmlCacheRef = useRef(new Map<string, string>());

  const [currentPath, setCurrentPath] = useState(initialChapterPath);
  const [currentTitle, setCurrentTitle] = useState<string | undefined>(
    initialChapterTitle,
  );
  const [rawHtml, setRawHtml] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [controlsHidden, setControlsHidden] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [reloadToken, setReloadToken] = useState(0);

  const hasMarkedReadRef = useRef(false);
  const onChapterChangeRef = useRef<Props["onChapterChange"]>(onChapterChange);
  const onChapterReadRef = useRef<Props["onChapterRead"]>(onChapterRead);

  useEffect(() => {
    onChapterChangeRef.current = onChapterChange;
  }, [onChapterChange]);

  useEffect(() => {
    onChapterReadRef.current = onChapterRead;
  }, [onChapterRead]);

  const chapterIndex = useMemo(
    () => chapters.findIndex((c) => c.path === currentPath),
    [chapters, currentPath],
  );

  const resolvedTitle =
    currentTitle || chapters[chapterIndex]?.name || "Reader";

  const canGoPrev = chapterIndex > 0;
  const canGoNext = chapterIndex >= 0 && chapterIndex < chapters.length - 1;

  const readerTheme = settings.reader.theme;
  const preparedHtml = useMemo(() => {
    return buildReaderHtml({
      rawHtml,
      backgroundColor: readerTheme.backgroundColor,
      textColor: readerTheme.textColor,
      fontSize: readerTheme.textSize,
      lineHeight: readerTheme.lineHeight,
      padding: readerTheme.padding,
      fontFamily: readerTheme.fontStyle,
      textAlign: readerTheme.textAlign,
      linkColor: theme.colors.primary,
      isDark: theme.isDark,
    });
  }, [
    rawHtml,
    readerTheme.backgroundColor,
    readerTheme.fontStyle,
    readerTheme.lineHeight,
    readerTheme.padding,
    readerTheme.textAlign,
    readerTheme.textColor,
    readerTheme.textSize,
    theme.colors.primary,
    theme.isDark,
  ]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      hasMarkedReadRef.current = false;
      setScrollProgress(0);
      setError(null);

      const cached = chapterHtmlCacheRef.current.get(currentPath);
      if (cached) {
        setRawHtml(cached);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const html = await loadChapterHtml(currentPath);
        if (cancelled) return;
        const next = html || "";
        chapterHtmlCacheRef.current.set(currentPath, next);
        setRawHtml(next);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load chapter.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [currentPath, loadChapterHtml, reloadToken]);

  useEffect(() => {
    if (chapterIndex < 0) return;
    onChapterChangeRef.current?.(chapters[chapterIndex], chapterIndex);
  }, [chapterIndex, chapters]);

  const goBack = useCallback(() => {
    if (onBack) onBack();
    else (navigation as any).goBack();
  }, [navigation, onBack]);

  const scrollToTop = useCallback(() => {
    webViewRef.current?.injectJavaScript(
      `(()=>{ try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {} })(); true;`,
    );
  }, []);

  const navigateTo = useCallback(
    (chapter: ReaderChapterItem) => {
      setControlsHidden(false);
      setDrawerVisible(false);
      setCurrentPath(chapter.path);
      setCurrentTitle(chapter.name);
    },
    [],
  );

  const goPrev = useCallback(() => {
    if (!canGoPrev) return;
    const prev = chapters[chapterIndex - 1];
    if (prev) navigateTo(prev);
  }, [canGoPrev, chapterIndex, chapters, navigateTo]);

  const goNext = useCallback(() => {
    if (!canGoNext) return;
    const next = chapters[chapterIndex + 1];
    if (next) navigateTo(next);
  }, [canGoNext, chapterIndex, chapters, navigateTo]);

  const injectedBeforeContent = useMemo(() => {
    return `(() => {
      const send = (payload) => {
        try { window.ReactNativeWebView?.postMessage(JSON.stringify(payload)); } catch {}
      };

      let scheduled = false;
      const calc = () => {
        const doc = document.documentElement;
        const body = document.body;
        const scrollTop = window.pageYOffset || doc.scrollTop || body.scrollTop || 0;
        const scrollHeight = Math.max(body.scrollHeight || 0, doc.scrollHeight || 0);
        const clientHeight = doc.clientHeight || window.innerHeight || 0;
        const denom = scrollHeight - clientHeight;
        const progress = denom <= 0 ? 100 : Math.min(100, Math.max(0, (scrollTop / denom) * 100));
        send({ type: 'scroll', progress });
      };
      const onScroll = () => {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => { scheduled = false; calc(); });
      };

      document.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('scroll', onScroll, { passive: true });

      document.addEventListener('click', (e) => {
        try {
          const t = e?.target;
          if (t && typeof t.closest === 'function' && t.closest('a')) return;
        } catch {}
        send({ type: 'toggle' });
      }, true);

      setTimeout(calc, 60);
    })(); true;`;
  }, []);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const raw = event?.nativeEvent?.data;
      if (!raw) return;
      let msg: WebMsg | null = null;
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }
      if (!msg || typeof msg !== "object" || !("type" in msg)) return;

      if (msg.type === "toggle") {
        setControlsHidden((prev) => !prev);
        return;
      }
      if (msg.type === "scroll") {
        const value =
          typeof msg.progress === "number" && Number.isFinite(msg.progress)
            ? msg.progress
            : 0;
        setScrollProgress(value);

        if (
          value >= 97 &&
          !hasMarkedReadRef.current &&
          chapterIndex >= 0 &&
          chapters[chapterIndex]
        ) {
          hasMarkedReadRef.current = true;
          onChapterReadRef.current?.(chapters[chapterIndex], chapterIndex);
        }
      }
    },
    [chapterIndex, chapters],
  );

  const shouldStartLoad = useCallback((request: any) => {
    const url = String(request?.url || "");
    if (!url) return false;
    if (
      url.startsWith("about:blank") ||
      url.startsWith("data:") ||
      url.startsWith("file:")
    ) {
      return true;
    }
    Linking.openURL(url).catch(() => {});
    return false;
  }, []);

  const menuItems = useMemo(() => {
    const items = [
      { id: "readerSettings", label: "Reader settings", onPress: () => (navigation as any).navigate("ReaderSettings") },
      { id: "readerTheme", label: "Reader theme", onPress: () => (navigation as any).navigate("ReaderTheme") },
      { id: "reload", label: "Reload chapter", onPress: () => {
        chapterHtmlCacheRef.current.delete(currentPath);
        setError(null);
        setLoading(true);
        setRawHtml("");
        setReloadToken((prev) => prev + 1);
      }},
    ];

    const withExtras =
      Array.isArray(extraMenuItems) && extraMenuItems.length
        ? [...extraMenuItems, ...items]
        : items;
    if (onOpenWeb)
      withExtras.unshift({
        id: "openWeb",
        label: "Open website",
        onPress: () => onOpenWeb(currentPath),
      });
    return withExtras;
  }, [currentPath, extraMenuItems, navigation, onOpenWeb]);

  const effectiveBaseUrl = useMemo(() => {
    if (isAbsoluteUrl(currentPath)) return currentPath;
    return baseUrl;
  }, [baseUrl, currentPath]);

  return (
    <View style={[styles.container, { backgroundColor: readerTheme.backgroundColor }]}>
      {settings.reader.general.keepScreenOn ? <KeepAwake /> : null}
      <StatusBar
        hidden={settings.reader.display.fullscreen && controlsHidden}
        barStyle={theme.isDark ? "light-content" : "dark-content"}
      />

      <WebView
        ref={webViewRef}
        source={{ html: preparedHtml, baseUrl: effectiveBaseUrl }}
        originWhitelist={["*"]}
        onMessage={handleMessage}
        injectedJavaScriptBeforeContentLoaded={injectedBeforeContent}
        onShouldStartLoadWithRequest={shouldStartLoad}
        javaScriptEnabled
        domStorageEnabled
        setSupportMultipleWindows={false}
        style={{ backgroundColor: "transparent" }}
      />

      {loading ? (
        <View style={[styles.center, { backgroundColor: readerTheme.backgroundColor }]}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={[styles.centerText, { color: theme.colors.textSecondary }]}>
            Loading…
          </Text>
        </View>
      ) : null}

      {error ? (
        <View style={[styles.center, { backgroundColor: readerTheme.backgroundColor }]}>
          <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
          <TouchableOpacity
            style={[
              styles.retryBtn,
              { backgroundColor: theme.colors.primary },
            ]}
            onPress={() => {
              chapterHtmlCacheRef.current.delete(currentPath);
              setError(null);
              setLoading(true);
              setReloadToken((prev) => prev + 1);
            }}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {!controlsHidden ? (
        <>
          <View
            style={[
              styles.topBar,
              {
                paddingTop: Math.max(insets.top, 10),
                backgroundColor: theme.colors.surface + "F2",
                borderBottomColor: theme.colors.border,
              },
            ]}
          >
            <TouchableOpacity onPress={goBack} style={styles.iconBtn}>
              <Ionicons name="arrow-back" size={22} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={[styles.chapterTitle, { color: theme.colors.text }]} numberOfLines={1}>
              {resolvedTitle}
            </Text>
            <TouchableOpacity
              onPress={() => setDrawerVisible(true)}
              disabled={chapters.length === 0}
              style={[styles.iconBtn, chapters.length === 0 && { opacity: 0.4 }]}
            >
              <Ionicons name="list" size={22} color={theme.colors.text} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.iconBtn}>
              <Ionicons name="ellipsis-vertical" size={20} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <View
            style={[
              styles.bottomBar,
              {
                paddingBottom: Math.max(insets.bottom, 10),
                backgroundColor: theme.colors.surface + "F2",
                borderTopColor: theme.colors.border,
              },
            ]}
          >
            <TouchableOpacity
              onPress={goPrev}
              disabled={!canGoPrev}
              style={[styles.bottomBtn, !canGoPrev && { opacity: 0.35 }]}
            >
              <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
            </TouchableOpacity>

            <TouchableOpacity onPress={scrollToTop} style={styles.bottomBtn}>
              <Ionicons name="arrow-up" size={20} color={theme.colors.text} />
            </TouchableOpacity>

            {settings.reader.display.showProgressPercentage ? (
              <View style={styles.progressWrap}>
                <Text style={[styles.progressText, { color: theme.colors.textSecondary }]}>
                  {Math.round(scrollProgress)}%
                </Text>
                <View
                  style={[
                    styles.progressBar,
                    { backgroundColor: theme.colors.border },
                  ]}
                >
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.max(0, Math.min(100, scrollProgress))}%`,
                        backgroundColor: theme.colors.primary,
                      },
                    ]}
                  />
                </View>
              </View>
            ) : (
              <View style={{ flex: 1 }} />
            )}

            <TouchableOpacity
              onPress={goNext}
              disabled={!canGoNext}
              style={[styles.bottomBtn, !canGoNext && { opacity: 0.35 }]}
            >
              <Ionicons name="chevron-forward" size={22} color={theme.colors.text} />
            </TouchableOpacity>
          </View>
        </>
      ) : null}

      <PopupMenu visible={menuVisible} onClose={() => setMenuVisible(false)} items={menuItems} />

      <ChapterDrawer
        visible={drawerVisible}
        chapters={chapters}
        currentPath={currentPath}
        onClose={() => setDrawerVisible(false)}
        onSelect={(chapter) => navigateTo(chapter)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 12,
  },
  centerText: { fontSize: 12 },
  errorText: { fontSize: 13, textAlign: "center" },
  retryBtn: { marginTop: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  retryText: { color: "#FFF", fontWeight: "800" },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  iconBtn: { padding: 10 },
  chapterTitle: { flex: 1, fontSize: 14, fontWeight: "800", paddingHorizontal: 6 },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  bottomBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  progressWrap: { flex: 1, gap: 6, paddingHorizontal: 10 },
  progressText: { fontSize: 12, fontWeight: "700", textAlign: "center" },
  progressBar: { height: 4, borderRadius: 999, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 999 },
});
