// src/components/reader/ChapterReader.tsx
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useKeepAwake } from "expo-keep-awake";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Animated,
  Linking,
  Modal,
  ScrollView,
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

// KeepAwake moved outside so it's a stable component reference
const KeepAwakeGuard: React.FC = () => {
  useKeepAwake();
  return null;
};

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
  // accepted for API compatibility — ChapterReader reads SettingsContext directly
  swipeToNavigate?: boolean;
  tapToScroll?: boolean;
  keepScreenOn?: boolean;
  showProgressPercentage?: boolean;
  readerTheme?: any;
};

type WebMsg =
  | { type: "scroll"; progress: number }
  | {
      type: "tap";
      yRatio: number;
      xRatio: number;
      zone: "top" | "middle" | "bottom";
    }
  | { type: "swipe"; direction: "left" | "right" };

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
  const safeBody = stripEventHandlers(
    stripScripts(extractBodyContent(opts.rawHtml || "")),
  );

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
    <style>
      :root { color-scheme: ${opts.isDark ? "dark" : "light"}; }
      html, body {
        width: 100%; height: 100%;
        margin: 0; padding: 0;
        background: ${opts.backgroundColor};
        color: ${opts.textColor};
      }
      body {
        display: flex;
        justify-content: center;
        -webkit-text-size-adjust: 100%;
        overflow-x: hidden;
      }
      #novelnest-reader {
        box-sizing: border-box;
        width: 100%;
        max-width: 720px;
        margin: 0 auto;
        padding: ${Math.max(0, opts.padding)}px;
        font-size: ${Math.max(10, opts.fontSize)}px;
        line-height: ${Math.max(1, opts.lineHeight)};
        font-family: ${opts.fontFamily || "system-ui"}, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
        text-align: ${opts.textAlign};
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

// ── Colour presets ────────────────────────────────────────────────────────────
const COLOR_PRESETS = [
  { key: "Default", bg: "#FFFFFF", fg: "#1A1A1A", label: "White" },
  { key: "Dark", bg: "#111111", fg: "#E8E8E8", label: "Dark" },
  { key: "Sepia", bg: "#F4E6C4", fg: "#4A3B2A", label: "Sepia" },
  { key: "Green", bg: "#E6F4EA", fg: "#143D1F", label: "Green" },
  { key: "Amoled", bg: "#000000", fg: "#FFFFFF", label: "AMOLED" },
] as const;

const FONT_OPTIONS = [
  { value: "System", label: "Sys" },
  { value: "Serif", label: "Serif" },
  { value: "Sans", label: "Sans" },
  { value: "Mono", label: "Mono" },
];

const ALIGN_OPTIONS = [
  { value: "left", icon: "reorder-two-outline" as const },
  { value: "center", icon: "menu-outline" as const },
  { value: "justify", icon: "reorder-four-outline" as const },
];

// ── Main component ────────────────────────────────────────────────────────────
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
  swipeToNavigate: _swipeToNavigate,
  tapToScroll: _tapToScroll,
  keepScreenOn: _keepScreenOn,
  showProgressPercentage: _showProgressPercentage,
  readerTheme: _readerTheme,
}) => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { settings, updateReaderSettings, updateReaderSettingsBatch } =
    useSettings();
  const insets = useSafeAreaInsets();

  const webViewRef = useRef<any>(null);
  // FIX: separate cache from in-memory so downloaded chapters skip async fetch entirely
  const chapterHtmlCacheRef = useRef(new Map<string, string>());

  const [currentPath, setCurrentPath] = useState(initialChapterPath);
  const [currentTitle, setCurrentTitle] = useState<string | undefined>(
    initialChapterTitle,
  );
  const [rawHtml, setRawHtml] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [reloadToken, setReloadToken] = useState(0);
  const [quickSettingsVisible, setQuickSettingsVisible] = useState(false);

  // ── Animation for top/bottom bars ────────────────────────────────────────
  const barsAnim = useRef(new Animated.Value(0)).current; // 0=hidden, 1=visible
  const isAnimatingRef = useRef(false);

  const showBars = useCallback(() => {
    if (isAnimatingRef.current) return;
    isAnimatingRef.current = true;
    setControlsVisible(true);
    Animated.spring(barsAnim, {
      toValue: 1,
      tension: 80,
      friction: 12,
      useNativeDriver: true,
    }).start(() => {
      isAnimatingRef.current = false;
    });
  }, [barsAnim]);

  const hideBars = useCallback(() => {
    if (isAnimatingRef.current) return;
    isAnimatingRef.current = true;
    Animated.timing(barsAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      isAnimatingRef.current = false;
      setControlsVisible(false);
    });
  }, [barsAnim]);

  const toggleBars = useCallback(() => {
    const current = (barsAnim as any)._value ?? 0;
    if (current > 0.5) hideBars();
    else showBars();
  }, [barsAnim, hideBars, showBars]);

  // refs for stability
  const controlsVisibleRef = useRef(controlsVisible);
  useEffect(() => {
    controlsVisibleRef.current = controlsVisible;
  }, [controlsVisible]);

  const hasMarkedReadRef = useRef(false);
  const onChapterChangeRef = useRef(onChapterChange);
  const onChapterReadRef = useRef(onChapterRead);
  useEffect(() => {
    onChapterChangeRef.current = onChapterChange;
  }, [onChapterChange]);
  useEffect(() => {
    onChapterReadRef.current = onChapterRead;
  }, [onChapterRead]);

  const swipeToNavigateRef = useRef(settings.reader.general.swipeToNavigate);
  const tapToScrollRef = useRef(settings.reader.general.tapToScroll);
  useEffect(() => {
    swipeToNavigateRef.current = settings.reader.general.swipeToNavigate;
  }, [settings.reader.general.swipeToNavigate]);
  useEffect(() => {
    tapToScrollRef.current = settings.reader.general.tapToScroll;
  }, [settings.reader.general.tapToScroll]);

  const chapterIndex = useMemo(
    () => chapters.findIndex((c) => c.path === currentPath),
    [chapters, currentPath],
  );
  const chapterIndexRef = useRef(chapterIndex);
  useEffect(() => {
    chapterIndexRef.current = chapterIndex;
  }, [chapterIndex]);
  const chaptersRef = useRef(chapters);
  useEffect(() => {
    chaptersRef.current = chapters;
  }, [chapters]);

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

  // ── Chapter loading (optimised) ──────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      hasMarkedReadRef.current = false;
      setScrollProgress(0);
      setError(null);

      // 1. Check in-memory cache first — synchronous, zero latency
      const cached = chapterHtmlCacheRef.current.get(currentPath);
      if (cached !== undefined) {
        setRawHtml(cached);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const html = await loadChapterHtml(currentPath);
        if (cancelled) return;
        const next = html || "";
        // Store in cache so subsequent visits are instant
        chapterHtmlCacheRef.current.set(currentPath, next);
        setRawHtml(next);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load chapter.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [currentPath, loadChapterHtml, reloadToken]);

  // FIX: skip spurious onChapterChange on mount
  const isMountedRef = useRef(false);
  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      return;
    }
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

  const navigateTo = useCallback((chapter: ReaderChapterItem) => {
    setDrawerVisible(false);
    setCurrentPath(chapter.path);
    setCurrentTitle(chapter.name);
    webViewRef.current?.injectJavaScript(
      `(()=>{ try { window.scrollTo({ top: 0 }); } catch {} })(); true;`,
    );
  }, []);

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

  const goPrevRef = useRef(goPrev);
  const goNextRef = useRef(goNext);
  useEffect(() => {
    goPrevRef.current = goPrev;
  }, [goPrev]);
  useEffect(() => {
    goNextRef.current = goNext;
  }, [goNext]);

  const toggleBarsRef = useRef(toggleBars);
  useEffect(() => {
    toggleBarsRef.current = toggleBars;
  }, [toggleBars]);

  // ── WebView injected JS ──────────────────────────────────────────────────
  // Sends scroll progress, tap zones, and swipe events.
  // Tap zones: top 15% = "top", bottom 15% = "bottom", middle = "middle".
  // Only the middle zone toggles bars by default. tapToScroll uses sides.
  const injectedBeforeContent = useMemo(() => {
    return `(() => {
      const send = (payload) => {
        try { window.ReactNativeWebView?.postMessage(JSON.stringify(payload)); } catch {}
      };

      // ── Scroll progress ───────────────────────────────────────────────
      let scrollScheduled = false;
      const calcScroll = () => {
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
        if (scrollScheduled) return;
        scrollScheduled = true;
        requestAnimationFrame(() => { scrollScheduled = false; calcScroll(); });
      };
      document.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('scroll', onScroll, { passive: true });

      // ── Tap & swipe detection ────────────────────────────────────────
      let touchStartX = 0, touchStartY = 0, touchStartTime = 0;

      const getZone = (clientY) => {
        const vh = window.innerHeight || document.documentElement.clientHeight || 1;
        const ratio = clientY / vh;
        if (ratio < 0.15) return 'top';
        if (ratio > 0.85) return 'bottom';
        return 'middle';
      };

      window.addEventListener('touchstart', (e) => {
        const t = e.touches && e.touches[0];
        if (!t) return;
        touchStartX = t.clientX;
        touchStartY = t.clientY;
        touchStartTime = Date.now();
      }, { passive: true });

      window.addEventListener('touchend', (e) => {
        const t = e.changedTouches && e.changedTouches[0];
        if (!t) return;
        const dx = t.clientX - touchStartX;
        const dy = t.clientY - touchStartY;
        const dt = Date.now() - touchStartTime;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        // Horizontal swipe
        if (dt < 600 && absDx > 60 && absDx > absDy * 1.5) {
          send({ type: 'swipe', direction: dx < 0 ? 'left' : 'right' });
          return;
        }

        // Tap (small movement)
        if (absDx < 20 && absDy < 20 && dt < 400) {
          const vh = window.innerHeight || document.documentElement.clientHeight || 1;
          const vw = window.innerWidth || document.documentElement.clientWidth || 1;
          const yRatio = t.clientY / vh;
          const xRatio = t.clientX / vw;
          const zone = getZone(t.clientY);
          // Ignore taps on links
          try {
            const target = document.elementFromPoint(t.clientX, t.clientY);
            if (target && typeof target.closest === 'function' && target.closest('a')) return;
          } catch {}
          send({ type: 'tap', yRatio, xRatio, zone });
        }
      }, { passive: true });

      // Fallback click for non-touch devices
      document.addEventListener('click', (e) => {
        try {
          const t = e?.target;
          if (t && typeof t.closest === 'function' && t.closest('a')) return;
          const y = e?.clientY ?? (window.innerHeight || 0) / 2;
          const x = e?.clientX ?? (window.innerWidth || 0) / 2;
          const vh = window.innerHeight || 1;
          const vw = window.innerWidth || 1;
          const zone = getZone(y);
          send({ type: 'tap', yRatio: y / vh, xRatio: x / vw, zone });
        } catch {
          send({ type: 'tap', yRatio: 0.5, xRatio: 0.5, zone: 'middle' });
        }
      }, true);

      setTimeout(calcScroll, 60);
    })(); true;`;
  }, []);

  // ── Stable message handler ───────────────────────────────────────────────
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

      if (msg.type === "scroll") {
        const value =
          typeof msg.progress === "number" && Number.isFinite(msg.progress)
            ? msg.progress
            : 0;
        setScrollProgress(value);

        // Auto-hide bars when user starts scrolling
        if (controlsVisibleRef.current && value > 0 && value < 99) {
          // small debounce — only hide after the user actually scrolls
          hideBars();
        }

        // Mark as read at 90%
        const idx = chapterIndexRef.current;
        const ch = chaptersRef.current;
        if (value >= 90 && !hasMarkedReadRef.current && idx >= 0 && ch[idx]) {
          hasMarkedReadRef.current = true;
          onChapterReadRef.current?.(ch[idx], idx);
          showBars(); // Show nav when chapter is done
        }
        return;
      }

      if (msg.type === "tap") {
        const { zone, yRatio, xRatio } = msg as any;
        const tapScroll = tapToScrollRef.current;

        if (tapScroll) {
          // tapToScroll: middle zone — left 40% scrolls up, right 40% scrolls down
          // centre 20% (0.4 < xRatio < 0.6) and top/bottom zones always toggle bars
          if (zone === "top" || zone === "bottom") {
            toggleBarsRef.current();
            return;
          }
          if (zone === "middle") {
            if (xRatio < 0.4) {
              // Tap left side → scroll up
              webViewRef.current?.injectJavaScript(
                `(()=>{ try { window.scrollBy({ top: -280, behavior: 'smooth' }); } catch {} })(); true;`,
              );
              return;
            } else if (xRatio > 0.6) {
              // Tap right side → scroll down
              webViewRef.current?.injectJavaScript(
                `(()=>{ try { window.scrollBy({ top: 280, behavior: 'smooth' }); } catch {} })(); true;`,
              );
              return;
            }
            // Centre strip toggles bars
            toggleBarsRef.current();
            return;
          }
        }

        // Default: any tap toggles bars
        toggleBarsRef.current();
        return;
      }

      if (msg.type === "swipe") {
        if (!swipeToNavigateRef.current) return;
        if (msg.direction === "left") goNextRef.current();
        else goPrevRef.current();
      }
    },
    [hideBars, showBars],
  ); // stable — all values read from refs

  // ── Auto-scroll ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!settings.reader.general.autoScroll) return;
    let cancelled = false;
    const id = setInterval(() => {
      if (cancelled) return;
      webViewRef.current?.injectJavaScript(
        `(()=>{try{window.scrollBy({top:2,behavior:'smooth'});}catch{}})();true;`,
      );
    }, 80);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [settings.reader.general.autoScroll]);

  const shouldStartLoad = useCallback((request: any) => {
    const url = String(request?.url || "");
    if (!url) return false;
    if (
      url.startsWith("about:blank") ||
      url.startsWith("data:") ||
      url.startsWith("file:")
    )
      return true;
    Linking.openURL(url).catch(() => {});
    return false;
  }, []);

  const menuItems = useMemo(() => {
    const items = [
      {
        id: "quickSettings",
        label: "Quick settings",
        onPress: () => setQuickSettingsVisible(true),
      },
      {
        id: "readerSettings",
        label: "Reader settings",
        onPress: () => (navigation as any).navigate("ReaderSettings"),
      },
      {
        id: "readerTheme",
        label: "Reader theme",
        onPress: () => (navigation as any).navigate("ReaderTheme"),
      },
      {
        id: "reload",
        label: "Reload chapter",
        onPress: () => {
          chapterHtmlCacheRef.current.delete(currentPath);
          setError(null);
          setLoading(true);
          setRawHtml("");
          setReloadToken((prev) => prev + 1);
        },
      },
    ];

    const withExtras =
      Array.isArray(extraMenuItems) && extraMenuItems.length
        ? [...extraMenuItems, ...items]
        : items;
    if (onOpenWeb)
      withExtras.unshift({
        id: "openWeb",
        label: "Open in browser",
        onPress: () => onOpenWeb(currentPath),
      });
    return withExtras;
  }, [currentPath, extraMenuItems, navigation, onOpenWeb]);

  const effectiveBaseUrl = useMemo(() => {
    if (isAbsoluteUrl(currentPath)) return currentPath;
    return baseUrl;
  }, [baseUrl, currentPath]);

  // ── Derived animation values ─────────────────────────────────────────────
  const topBarTranslate = barsAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-80, 0],
  });
  const bottomBarTranslate = barsAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [80, 0],
  });
  const barsOpacity = barsAnim;

  // Quick settings state helpers
  const t = settings.reader.theme;
  const g = settings.reader.general;
  const d = settings.reader.display;
  const topBarHeight = insets.top + 52;
  const bottomBarHeight = insets.bottom + 64;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: readerTheme.backgroundColor },
      ]}
    >
      {settings.reader.general.keepScreenOn ? <KeepAwakeGuard /> : null}
      <StatusBar
        hidden={settings.reader.display.fullscreen && !controlsVisible}
        barStyle={theme.isDark ? "light-content" : "dark-content"}
      />

      {/* ── WebView ─────────────────────────────────────────────────── */}
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
        // Performance: disable unnecessary features
        cacheEnabled
        cacheMode="LOAD_CACHE_ELSE_NETWORK"
        style={{ backgroundColor: "transparent" }}
      />

      {/* ── Loading overlay ──────────────────────────────────────────── */}
      {loading ? (
        <View
          style={[
            styles.center,
            { backgroundColor: readerTheme.backgroundColor },
          ]}
        >
          <View
            style={[
              styles.loadingCard,
              { backgroundColor: theme.colors.surface },
            ]}
          >
            <ActivityIndicator color={theme.colors.primary} size="large" />
            <Text
              style={[
                styles.loadingText,
                { color: theme.colors.textSecondary },
              ]}
            >
              Loading chapter…
            </Text>
          </View>
        </View>
      ) : null}

      {/* ── Error overlay ────────────────────────────────────────────── */}
      {error ? (
        <View
          style={[
            styles.center,
            { backgroundColor: readerTheme.backgroundColor },
          ]}
        >
          <View
            style={[
              styles.errorCard,
              { backgroundColor: theme.colors.surface },
            ]}
          >
            <View
              style={[
                styles.errorIcon,
                { backgroundColor: theme.colors.error + "20" },
              ]}
            >
              <Ionicons
                name="alert-circle"
                size={32}
                color={theme.colors.error}
              />
            </View>
            <Text style={[styles.errorTitle, { color: theme.colors.text }]}>
              Failed to load
            </Text>
            <Text
              style={[styles.errorMsg, { color: theme.colors.textSecondary }]}
            >
              {error}
            </Text>
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
              <Ionicons name="refresh" size={16} color="#FFF" />
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* ── Top bar ─────────────────────────────────────────────────── */}
      {controlsVisible ? (
        <Animated.View
          style={[
            styles.topBar,
            {
              paddingTop: Math.max(insets.top, 10),
              backgroundColor: theme.colors.surface + "F4",
              borderBottomColor: theme.colors.border,
              opacity: barsOpacity,
              transform: [{ translateY: topBarTranslate }],
            },
          ]}
        >
          <TouchableOpacity
            onPress={goBack}
            style={styles.iconBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="arrow-back" size={22} color={theme.colors.text} />
          </TouchableOpacity>

          <View style={styles.titleWrap}>
            <Text
              style={[styles.chapterTitle, { color: theme.colors.text }]}
              numberOfLines={1}
            >
              {resolvedTitle}
            </Text>
            {chapters.length > 0 && (
              <Text
                style={[
                  styles.chapterCount,
                  { color: theme.colors.textSecondary },
                ]}
              >
                {chapterIndex >= 0
                  ? `${chapterIndex + 1} / ${chapters.length}`
                  : ""}
              </Text>
            )}
          </View>

          <TouchableOpacity
            onPress={() => setDrawerVisible(true)}
            disabled={chapters.length === 0}
            style={[styles.iconBtn, chapters.length === 0 && { opacity: 0.4 }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="list" size={22} color={theme.colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setMenuVisible(true)}
            style={styles.iconBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name="ellipsis-vertical"
              size={20}
              color={theme.colors.text}
            />
          </TouchableOpacity>
        </Animated.View>
      ) : null}

      {/* ── Bottom bar ──────────────────────────────────────────────── */}
      {controlsVisible ? (
        <Animated.View
          style={[
            styles.bottomBar,
            {
              paddingBottom: Math.max(insets.bottom, 10),
              backgroundColor: theme.colors.surface + "F4",
              borderTopColor: theme.colors.border,
              opacity: barsOpacity,
              transform: [{ translateY: bottomBarTranslate }],
            },
          ]}
        >
          {/* Prev chapter */}
          {!settings.reader.general.swipeToNavigate ? (
            <TouchableOpacity
              onPress={goPrev}
              disabled={!canGoPrev}
              style={[
                styles.navBtn,
                {
                  backgroundColor: canGoPrev
                    ? theme.colors.primary + "18"
                    : "transparent",
                },
              ]}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Ionicons
                name="chevron-back"
                size={20}
                color={
                  canGoPrev ? theme.colors.primary : theme.colors.textSecondary
                }
              />
            </TouchableOpacity>
          ) : (
            <View style={styles.navBtn} />
          )}

          {/* Scroll to top */}
          <TouchableOpacity
            onPress={scrollToTop}
            style={[
              styles.navBtn,
              { backgroundColor: theme.colors.primary + "14" },
            ]}
          >
            <Ionicons name="arrow-up" size={19} color={theme.colors.primary} />
          </TouchableOpacity>

          {/* Progress */}
          {settings.reader.display.showProgressPercentage ? (
            <View style={styles.progressWrap}>
              <Text style={[styles.progressPct, { color: theme.colors.text }]}>
                {Math.round(scrollProgress)}%
              </Text>
              <View
                style={[
                  styles.progressTrack,
                  { backgroundColor: theme.colors.border },
                ]}
              >
                <View
                  style={[
                    styles.progressFill,
                    {
                      width:
                        `${Math.max(0, Math.min(100, scrollProgress))}%` as any,
                      backgroundColor:
                        scrollProgress >= 99 ? "#22C55E" : theme.colors.primary,
                    },
                  ]}
                />
              </View>
            </View>
          ) : (
            <View style={{ flex: 1 }} />
          )}

          {/* Quick settings */}
          <TouchableOpacity
            onPress={() => setQuickSettingsVisible(true)}
            style={[
              styles.navBtn,
              { backgroundColor: theme.colors.primary + "14" },
            ]}
          >
            <Ionicons name="text" size={18} color={theme.colors.primary} />
          </TouchableOpacity>

          {/* Next chapter */}
          {!settings.reader.general.swipeToNavigate ? (
            <TouchableOpacity
              onPress={goNext}
              disabled={!canGoNext}
              style={[
                styles.navBtn,
                {
                  backgroundColor: canGoNext
                    ? theme.colors.primary + "18"
                    : "transparent",
                },
              ]}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Ionicons
                name="chevron-forward"
                size={20}
                color={
                  canGoNext ? theme.colors.primary : theme.colors.textSecondary
                }
              />
            </TouchableOpacity>
          ) : (
            <View style={styles.navBtn} />
          )}
        </Animated.View>
      ) : null}

      {/* ── Popup menu ──────────────────────────────────────────────── */}
      <PopupMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        items={menuItems}
      />

      {/* ── Chapter drawer ──────────────────────────────────────────── */}
      <ChapterDrawer
        visible={drawerVisible}
        chapters={chapters}
        currentPath={currentPath}
        onClose={() => setDrawerVisible(false)}
        onSelect={(chapter) => navigateTo(chapter)}
      />

      {/* ── Quick settings bottom sheet ─────────────────────────────── */}
      <Modal
        visible={quickSettingsVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setQuickSettingsVisible(false)}
        statusBarTranslucent
      >
        <TouchableOpacity
          activeOpacity={1}
          style={styles.sheetOverlay}
          onPress={() => setQuickSettingsVisible(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[
              styles.sheetCard,
              {
                backgroundColor: theme.colors.surface,
                paddingBottom: Math.max(insets.bottom, 20),
              },
            ]}
            onPress={() => {}}
          >
            {/* Handle pill */}
            <View
              style={[
                styles.sheetHandle,
                { backgroundColor: theme.colors.border },
              ]}
            />

            {/* Header */}
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: theme.colors.text }]}>
                Reading Settings
              </Text>
              <TouchableOpacity
                onPress={() => setQuickSettingsVisible(false)}
                style={[
                  styles.sheetCloseBtn,
                  { backgroundColor: theme.colors.border },
                ]}
              >
                <Ionicons
                  name="close"
                  size={16}
                  color={theme.colors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: 480 }}
            >
              {/* ── Colour themes ────────────────────────────── */}
              <View style={styles.qs_section}>
                <Text
                  style={[
                    styles.qs_label,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  Background
                </Text>
                <View style={styles.qs_colorRow}>
                  {COLOR_PRESETS.map((p) => {
                    const active =
                      t.backgroundColor === p.bg && t.textColor === p.fg;
                    return (
                      <TouchableOpacity
                        key={p.key}
                        style={[
                          styles.colorChip,
                          {
                            backgroundColor: p.bg,
                            borderColor: active
                              ? theme.colors.primary
                              : theme.colors.border,
                          },
                          active && styles.colorChipActive,
                        ]}
                        onPress={() =>
                          void updateReaderSettingsBatch([
                            {
                              section: "theme",
                              key: "backgroundColor",
                              value: p.bg,
                            },
                            { section: "theme", key: "textColor", value: p.fg },
                            { section: "theme", key: "preset", value: p.key },
                          ])
                        }
                      >
                        <Text style={[styles.colorChipLabel, { color: p.fg }]}>
                          {p.label}
                        </Text>
                        {active && (
                          <View
                            style={[
                              styles.colorChipCheck,
                              { backgroundColor: theme.colors.primary },
                            ]}
                          >
                            <Ionicons name="checkmark" size={9} color="#FFF" />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* ── Font size ────────────────────────────────── */}
              <View
                style={[
                  styles.qs_section,
                  styles.qs_divider,
                  { borderColor: theme.colors.divider },
                ]}
              >
                <View style={styles.qs_row}>
                  <View style={styles.qs_rowLeft}>
                    <Ionicons
                      name="text-outline"
                      size={16}
                      color={theme.colors.primary}
                      style={styles.qs_icon}
                    />
                    <Text
                      style={[styles.qs_rowLabel, { color: theme.colors.text }]}
                    >
                      Font size
                    </Text>
                  </View>
                  <View style={styles.stepperRow}>
                    <TouchableOpacity
                      style={[
                        styles.stepperBtn,
                        { borderColor: theme.colors.border },
                      ]}
                      onPress={() =>
                        void updateReaderSettings(
                          "theme",
                          "textSize",
                          Math.max(10, t.textSize - 1),
                        )
                      }
                      disabled={t.textSize <= 10}
                    >
                      <Text
                        style={[
                          styles.stepperBtnTxt,
                          {
                            color:
                              t.textSize <= 10
                                ? theme.colors.textSecondary
                                : theme.colors.primary,
                          },
                        ]}
                      >
                        −
                      </Text>
                    </TouchableOpacity>
                    <Text
                      style={[styles.stepperVal, { color: theme.colors.text }]}
                    >
                      {t.textSize}px
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.stepperBtn,
                        { borderColor: theme.colors.border },
                      ]}
                      onPress={() =>
                        void updateReaderSettings(
                          "theme",
                          "textSize",
                          Math.min(40, t.textSize + 1),
                        )
                      }
                      disabled={t.textSize >= 40}
                    >
                      <Text
                        style={[
                          styles.stepperBtnTxt,
                          {
                            color:
                              t.textSize >= 40
                                ? theme.colors.textSecondary
                                : theme.colors.primary,
                          },
                        ]}
                      >
                        +
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* ── Line height ──────────────────────────────── */}
              <View
                style={[
                  styles.qs_section,
                  styles.qs_divider,
                  { borderColor: theme.colors.divider },
                ]}
              >
                <View style={styles.qs_row}>
                  <View style={styles.qs_rowLeft}>
                    <Ionicons
                      name="reorder-four-outline"
                      size={16}
                      color={theme.colors.primary}
                      style={styles.qs_icon}
                    />
                    <Text
                      style={[styles.qs_rowLabel, { color: theme.colors.text }]}
                    >
                      Line height
                    </Text>
                  </View>
                  <View style={styles.stepperRow}>
                    <TouchableOpacity
                      style={[
                        styles.stepperBtn,
                        { borderColor: theme.colors.border },
                      ]}
                      onPress={() =>
                        void updateReaderSettings(
                          "theme",
                          "lineHeight",
                          Math.round(Math.max(1, t.lineHeight - 0.1) * 10) / 10,
                        )
                      }
                      disabled={t.lineHeight <= 1}
                    >
                      <Text
                        style={[
                          styles.stepperBtnTxt,
                          {
                            color:
                              t.lineHeight <= 1
                                ? theme.colors.textSecondary
                                : theme.colors.primary,
                          },
                        ]}
                      >
                        −
                      </Text>
                    </TouchableOpacity>
                    <Text
                      style={[styles.stepperVal, { color: theme.colors.text }]}
                    >
                      {t.lineHeight.toFixed(1)}
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.stepperBtn,
                        { borderColor: theme.colors.border },
                      ]}
                      onPress={() =>
                        void updateReaderSettings(
                          "theme",
                          "lineHeight",
                          Math.round(Math.min(3, t.lineHeight + 0.1) * 10) / 10,
                        )
                      }
                      disabled={t.lineHeight >= 3}
                    >
                      <Text
                        style={[
                          styles.stepperBtnTxt,
                          {
                            color:
                              t.lineHeight >= 3
                                ? theme.colors.textSecondary
                                : theme.colors.primary,
                          },
                        ]}
                      >
                        +
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* ── Padding ──────────────────────────────────── */}
              <View
                style={[
                  styles.qs_section,
                  styles.qs_divider,
                  { borderColor: theme.colors.divider },
                ]}
              >
                <View style={styles.qs_row}>
                  <View style={styles.qs_rowLeft}>
                    <Ionicons
                      name="contract-outline"
                      size={16}
                      color={theme.colors.primary}
                      style={styles.qs_icon}
                    />
                    <Text
                      style={[styles.qs_rowLabel, { color: theme.colors.text }]}
                    >
                      Padding
                    </Text>
                  </View>
                  <View style={styles.stepperRow}>
                    <TouchableOpacity
                      style={[
                        styles.stepperBtn,
                        { borderColor: theme.colors.border },
                      ]}
                      onPress={() =>
                        void updateReaderSettings(
                          "theme",
                          "padding",
                          Math.max(0, t.padding - 4),
                        )
                      }
                      disabled={t.padding <= 0}
                    >
                      <Text
                        style={[
                          styles.stepperBtnTxt,
                          {
                            color:
                              t.padding <= 0
                                ? theme.colors.textSecondary
                                : theme.colors.primary,
                          },
                        ]}
                      >
                        −
                      </Text>
                    </TouchableOpacity>
                    <Text
                      style={[styles.stepperVal, { color: theme.colors.text }]}
                    >
                      {t.padding}px
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.stepperBtn,
                        { borderColor: theme.colors.border },
                      ]}
                      onPress={() =>
                        void updateReaderSettings(
                          "theme",
                          "padding",
                          Math.min(64, t.padding + 4),
                        )
                      }
                      disabled={t.padding >= 64}
                    >
                      <Text
                        style={[
                          styles.stepperBtnTxt,
                          {
                            color:
                              t.padding >= 64
                                ? theme.colors.textSecondary
                                : theme.colors.primary,
                          },
                        ]}
                      >
                        +
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* ── Font style ───────────────────────────────── */}
              <View
                style={[
                  styles.qs_section,
                  styles.qs_divider,
                  { borderColor: theme.colors.divider },
                ]}
              >
                <View style={styles.qs_row}>
                  <View style={styles.qs_rowLeft}>
                    <Ionicons
                      name="language-outline"
                      size={16}
                      color={theme.colors.primary}
                      style={styles.qs_icon}
                    />
                    <Text
                      style={[styles.qs_rowLabel, { color: theme.colors.text }]}
                    >
                      Font
                    </Text>
                  </View>
                  <View style={styles.chipRow}>
                    {FONT_OPTIONS.map((f) => {
                      const active = t.fontStyle === f.value;
                      return (
                        <TouchableOpacity
                          key={f.value}
                          style={[
                            styles.optionChip,
                            {
                              backgroundColor: active
                                ? theme.colors.primary
                                : theme.colors.primary + "12",
                              borderColor: active
                                ? theme.colors.primary
                                : "transparent",
                            },
                          ]}
                          onPress={() =>
                            void updateReaderSettings(
                              "theme",
                              "fontStyle",
                              f.value,
                            )
                          }
                        >
                          <Text
                            style={[
                              styles.optionChipTxt,
                              { color: active ? "#FFF" : theme.colors.primary },
                            ]}
                          >
                            {f.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>

              {/* ── Text alignment ───────────────────────────── */}
              <View
                style={[
                  styles.qs_section,
                  styles.qs_divider,
                  { borderColor: theme.colors.divider },
                ]}
              >
                <View style={styles.qs_row}>
                  <View style={styles.qs_rowLeft}>
                    <Ionicons
                      name="reorder-two-outline"
                      size={16}
                      color={theme.colors.primary}
                      style={styles.qs_icon}
                    />
                    <Text
                      style={[styles.qs_rowLabel, { color: theme.colors.text }]}
                    >
                      Align
                    </Text>
                  </View>
                  <View style={styles.chipRow}>
                    {ALIGN_OPTIONS.map((a) => {
                      const active = (t.textAlign ?? "left") === a.value;
                      return (
                        <TouchableOpacity
                          key={a.value}
                          style={[
                            styles.iconChip,
                            {
                              backgroundColor: active
                                ? theme.colors.primary
                                : theme.colors.primary + "12",
                            },
                          ]}
                          onPress={() =>
                            void updateReaderSettings(
                              "theme",
                              "textAlign",
                              a.value,
                            )
                          }
                        >
                          <Ionicons
                            name={a.icon}
                            size={18}
                            color={active ? "#FFF" : theme.colors.primary}
                          />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>

              {/* ── Toggles ──────────────────────────────────── */}
              <View
                style={[
                  styles.qs_section,
                  styles.qs_divider,
                  { borderColor: theme.colors.divider },
                ]}
              >
                <View style={[styles.qs_toggleRow]}>
                  {[
                    {
                      key: "fullscreen",
                      label: "Fullscreen",
                      icon: "expand-outline" as const,
                      val: d.fullscreen,
                      section: "display" as const,
                    },
                    {
                      key: "showProgressPercentage",
                      label: "Progress",
                      icon: "analytics-outline" as const,
                      val: d.showProgressPercentage,
                      section: "display" as const,
                    },
                    {
                      key: "keepScreenOn",
                      label: "Keep awake",
                      icon: "phone-portrait-outline" as const,
                      val: g.keepScreenOn,
                      section: "general" as const,
                    },
                    {
                      key: "swipeToNavigate",
                      label: "Swipe nav",
                      icon: "swap-horizontal-outline" as const,
                      val: g.swipeToNavigate,
                      section: "general" as const,
                    },
                  ].map((toggle) => (
                    <TouchableOpacity
                      key={toggle.key}
                      style={[
                        styles.toggleChip,
                        {
                          backgroundColor: toggle.val
                            ? theme.colors.primary + "18"
                            : theme.colors.border + "60",
                          borderColor: toggle.val
                            ? theme.colors.primary + "60"
                            : theme.colors.border,
                        },
                      ]}
                      onPress={() =>
                        void updateReaderSettings(
                          toggle.section,
                          toggle.key,
                          !toggle.val,
                        )
                      }
                    >
                      <Ionicons
                        name={toggle.icon}
                        size={14}
                        color={
                          toggle.val
                            ? theme.colors.primary
                            : theme.colors.textSecondary
                        }
                      />
                      <Text
                        style={[
                          styles.toggleChipTxt,
                          {
                            color: toggle.val
                              ? theme.colors.primary
                              : theme.colors.textSecondary,
                          },
                        ]}
                      >
                        {toggle.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* ── Link to full settings ────────────────────── */}
              <TouchableOpacity
                style={[
                  styles.qs_linkRow,
                  { borderColor: theme.colors.divider },
                ]}
                onPress={() => {
                  setQuickSettingsVisible(false);
                  setTimeout(
                    () => (navigation as any).navigate("ReaderSettings"),
                    200,
                  );
                }}
              >
                <Text
                  style={[styles.qs_linkTxt, { color: theme.colors.primary }]}
                >
                  All reader settings
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={15}
                  color={theme.colors.primary}
                />
              </TouchableOpacity>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },

  // Loading / error
  center: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingCard: {
    padding: 28,
    borderRadius: 20,
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  loadingText: { fontSize: 13 },
  errorCard: {
    padding: 28,
    borderRadius: 20,
    alignItems: "center",
    gap: 10,
    maxWidth: 300,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  errorIcon: {
    width: 60,
    height: 60,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  errorTitle: { fontSize: 17, fontWeight: "800" },
  errorMsg: { fontSize: 13, textAlign: "center", lineHeight: 18 },
  retryBtn: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 12,
    gap: 6,
  },
  retryText: { color: "#FFF", fontWeight: "700", fontSize: 14 },

  // Top bar
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBtn: { padding: 10 },
  titleWrap: { flex: 1, paddingHorizontal: 4 },
  chapterTitle: { fontSize: 14, fontWeight: "700" },
  chapterCount: { fontSize: 11, marginTop: 1 },

  // Bottom bar
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
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  progressWrap: { flex: 1, gap: 5, paddingHorizontal: 6 },
  progressPct: {
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  progressTrack: { height: 4, borderRadius: 999, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 999 },

  // Quick settings sheet
  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheetCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 999,
    alignSelf: "center",
    marginBottom: 8,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginBottom: 4,
  },
  sheetTitle: { fontSize: 17, fontWeight: "800" },
  sheetCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },

  // Quick settings inner
  qs_section: { paddingHorizontal: 20, paddingVertical: 14 },
  qs_divider: { borderTopWidth: StyleSheet.hairlineWidth },
  qs_label: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 12,
  },
  qs_row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  qs_rowLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  qs_icon: { opacity: 0.9 },
  qs_rowLabel: { fontSize: 14, fontWeight: "500" },

  // Colour chips
  qs_colorRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  colorChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  colorChipActive: { borderWidth: 2.5 },
  colorChipLabel: { fontSize: 12, fontWeight: "700" },
  colorChipCheck: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },

  // Stepper
  stepperRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepperBtn: {
    width: 32,
    height: 32,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperBtnTxt: { fontSize: 18, fontWeight: "600", lineHeight: 22 },
  stepperVal: {
    minWidth: 52,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
  },

  // Option / icon chips
  chipRow: { flexDirection: "row", gap: 6 },
  optionChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  optionChipTxt: { fontSize: 12, fontWeight: "700" },
  iconChip: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  // Toggle chips
  qs_toggleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  toggleChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  toggleChipTxt: { fontSize: 12, fontWeight: "600" },

  // Link row
  qs_linkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginHorizontal: 20,
  },
  qs_linkTxt: { fontSize: 14, fontWeight: "600" },
});
