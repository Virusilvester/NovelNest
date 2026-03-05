import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useKeepAwake } from "expo-keep-awake";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
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
  | { type: "scroll"; progress: number }
  | { type: "tap"; yRatio: number }
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
      html, body {
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
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
        font-family: ${
          opts.fontFamily || "system-ui"
        }, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
        text-align: ${opts.textAlign};
      }
      img,
      video {
        max-width: 100%;
        height: auto;
      }
      pre,
      code {
        white-space: pre-wrap;
        word-wrap: break-word;
      }
      a {
        color: ${opts.linkColor};
      }
      table {
        max-width: 100%;
      }
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
  const { settings, updateReaderSettings } = useSettings();
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
  const [controlsHidden, setControlsHidden] = useState(true);
  const [menuVisible, setMenuVisible] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [reloadToken, setReloadToken] = useState(0);
  const [settingsVisible, setSettingsVisible] = useState(false);

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

      const sendTap = (clientY) => {
        const vh = window.innerHeight || document.documentElement.clientHeight || 1;
        const yRatio = vh > 0 ? clientY / vh : 0.5;
        send({ type: 'tap', yRatio });
      };

      document.addEventListener('click', (e) => {
        try {
          const t = e?.target;
          if (t && typeof t.closest === 'function' && t.closest('a')) return;
          const y = e?.clientY ?? (e?.touches?.[0]?.clientY ?? (window.innerHeight || 0) / 2);
          sendTap(y);
        } catch {
          send({ type: 'tap', yRatio: 0.5 });
        }
      }, true);

      let touchStartX = 0;
      let touchStartY = 0;
      let touchStartTime = 0;

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

        if (dt < 600 && absDx > 60 && absDx > absDy) {
          send({ type: 'swipe', direction: dx < 0 ? 'left' : 'right' });
        } else {
          const y = t.clientY;
          sendTap(y);
        }
      }, { passive: true });

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

      if (msg.type === "scroll") {
        const value =
          typeof msg.progress === "number" && Number.isFinite(msg.progress)
            ? msg.progress
            : 0;
        setScrollProgress(value);

        // Hide controls while actively scrolling to give a clean reading view.
        if (!controlsHidden && value > 0) {
          setControlsHidden(true);
        }

        if (
          value >= 90 &&
          !hasMarkedReadRef.current &&
          chapterIndex >= 0 &&
          chapters[chapterIndex]
        ) {
          hasMarkedReadRef.current = true;
          onChapterReadRef.current?.(chapters[chapterIndex], chapterIndex);
          // Show navigation controls when reaching the end
          setControlsHidden(false);
        }
        return;
      }

      if (msg.type === "tap") {
        const yRatioRaw =
          typeof msg.yRatio === "number" && Number.isFinite(msg.yRatio)
            ? msg.yRatio
            : 0.5;
        const yRatio = Math.max(0, Math.min(1, yRatioRaw));

        if (settings.reader.general.tapToScroll) {
          if (yRatio < 0.33) {
            webViewRef.current?.injectJavaScript(
              `(()=>{try{const h=window.innerHeight||document.documentElement.clientHeight||400;window.scrollBy({top:-0.6*h,behavior:'smooth'});}catch{}})();true;`,
            );
          } else if (yRatio > 0.66) {
            webViewRef.current?.injectJavaScript(
              `(()=>{try{const h=window.innerHeight||document.documentElement.clientHeight||400;window.scrollBy({top:0.6*h,behavior:'smooth'});}catch{}})();true;`,
            );
          } else {
            setControlsHidden((prev) => !prev);
          }
        } else {
          setControlsHidden((prev) => !prev);
        }
        return;
      }

      if (msg.type === "swipe") {
        if (!settings.reader.general.swipeToNavigate) return;
        if (msg.direction === "left") {
          goNext();
        } else {
          goPrev();
        }
      }
    },
    [
      chapterIndex,
      chapters,
      controlsHidden,
      goNext,
      goPrev,
      settings.reader.general.swipeToNavigate,
      settings.reader.general.tapToScroll,
    ],
  );

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
    ) {
      return true;
    }
    Linking.openURL(url).catch(() => {});
    return false;
  }, []);

  const menuItems = useMemo(() => {
    const items = [
      {
        id: "quickReaderSettings",
        label: "Quick reader settings",
        onPress: () => setSettingsVisible(true),
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
            {!settings.reader.general.swipeToNavigate ? (
              <TouchableOpacity
                onPress={goPrev}
                disabled={!canGoPrev}
                style={[styles.bottomBtn, !canGoPrev && { opacity: 0.35 }]}
              >
                <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
              </TouchableOpacity>
            ) : (
              <View style={[styles.bottomBtn, { opacity: 0 }]} />
            )}

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

            {!settings.reader.general.swipeToNavigate ? (
              <TouchableOpacity
                onPress={goNext}
                disabled={!canGoNext}
                style={[styles.bottomBtn, !canGoNext && { opacity: 0.35 }]}
              >
                <Ionicons name="chevron-forward" size={22} color={theme.colors.text} />
              </TouchableOpacity>
            ) : (
              <View style={[styles.bottomBtn, { opacity: 0 }]} />
            )}
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

      <Modal
        visible={settingsVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSettingsVisible(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={styles.settingsOverlay}
          onPress={() => setSettingsVisible(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[
              styles.settingsCard,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
            onPress={() => {}}
          >
            <Text style={[styles.settingsTitle, { color: theme.colors.text }]}>
              Reader settings
            </Text>

            <View style={styles.settingsRow}>
              <Text
                style={[styles.settingsLabel, { color: theme.colors.textSecondary }]}
              >
                Text size
              </Text>
              <View style={styles.settingsControls}>
                <TouchableOpacity
                  style={styles.settingsIconBtn}
                  onPress={() => {
                    const current = settings.reader.theme.textSize;
                    const next = Math.max(10, current - 1);
                    void updateReaderSettings("theme", "textSize", next);
                  }}
                >
                  <Ionicons
                    name="remove"
                    size={20}
                    color={theme.colors.primary}
                  />
                </TouchableOpacity>
                <Text
                  style={[
                    styles.settingsValue,
                    { color: theme.colors.text },
                  ]}
                >
                  {settings.reader.theme.textSize}
                </Text>
                <TouchableOpacity
                  style={styles.settingsIconBtn}
                  onPress={() => {
                    const current = settings.reader.theme.textSize;
                    const next = Math.min(40, current + 1);
                    void updateReaderSettings("theme", "textSize", next);
                  }}
                >
                  <Ionicons
                    name="add"
                    size={20}
                    color={theme.colors.primary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.settingsRow}>
              <Text
                style={[styles.settingsLabel, { color: theme.colors.textSecondary }]}
              >
                Line height
              </Text>
              <View style={styles.settingsControls}>
                <TouchableOpacity
                  style={styles.settingsIconBtn}
                  onPress={() => {
                    const current = settings.reader.theme.lineHeight;
                    const next =
                      Math.round(Math.max(1, current - 0.1) * 10) / 10;
                    void updateReaderSettings("theme", "lineHeight", next);
                  }}
                >
                  <Ionicons
                    name="remove"
                    size={20}
                    color={theme.colors.primary}
                  />
                </TouchableOpacity>
                <Text
                  style={[
                    styles.settingsValue,
                    { color: theme.colors.text },
                  ]}
                >
                  {settings.reader.theme.lineHeight.toFixed(1)}
                </Text>
                <TouchableOpacity
                  style={styles.settingsIconBtn}
                  onPress={() => {
                    const current = settings.reader.theme.lineHeight;
                    const next =
                      Math.round(Math.min(3, current + 0.1) * 10) / 10;
                    void updateReaderSettings("theme", "lineHeight", next);
                  }}
                >
                  <Ionicons
                    name="add"
                    size={20}
                    color={theme.colors.primary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.settingsRow}>
              <Text
                style={[styles.settingsLabel, { color: theme.colors.textSecondary }]}
              >
                Page padding
              </Text>
              <View style={styles.settingsControls}>
                <TouchableOpacity
                  style={styles.settingsIconBtn}
                  onPress={() => {
                    const current = settings.reader.theme.padding;
                    const next = Math.max(0, current - 2);
                    void updateReaderSettings("theme", "padding", next);
                  }}
                >
                  <Ionicons
                    name="remove"
                    size={20}
                    color={theme.colors.primary}
                  />
                </TouchableOpacity>
                <Text
                  style={[
                    styles.settingsValue,
                    { color: theme.colors.text },
                  ]}
                >
                  {settings.reader.theme.padding}px
                </Text>
                <TouchableOpacity
                  style={styles.settingsIconBtn}
                  onPress={() => {
                    const current = settings.reader.theme.padding;
                    const next = Math.min(64, current + 2);
                    void updateReaderSettings("theme", "padding", next);
                  }}
                >
                  <Ionicons
                    name="add"
                    size={20}
                    color={theme.colors.primary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.settingsFooter}>
              <TouchableOpacity
                style={[
                  styles.settingsCloseBtn,
                  { backgroundColor: theme.colors.primary },
                ]}
                onPress={() => setSettingsVisible(false)}
              >
                <Text style={styles.settingsCloseText}>Done</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
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
  settingsOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  settingsCard: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 18,
    gap: 12,
  },
  settingsTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 4,
  },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  settingsLabel: {
    fontSize: 14,
    flex: 1,
    paddingRight: 12,
  },
  settingsControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  settingsIconBtn: {
    padding: 6,
    borderRadius: 999,
  },
  settingsValue: {
    fontSize: 14,
    minWidth: 40,
    textAlign: "center",
    fontWeight: "600",
  },
  settingsFooter: {
    marginTop: 8,
    alignItems: "flex-end",
  },
  settingsCloseBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
  },
  settingsCloseText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 14,
  },
});
