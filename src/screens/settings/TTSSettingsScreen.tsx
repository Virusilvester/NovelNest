// src/screens/settings/TTSSettingsScreen.tsx
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import * as Speech from "expo-speech";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Header } from "../../components/common/Header";
import { ImprovedSwitch } from "../../components/common/ImprovedSwitch";
import { SelectionModal } from "../../components/common/SelectionModal";
import { SettingsRow, SettingsSection } from "../../components/settings/SettingsList";
import { useSettings } from "../../context/SettingsContext";
import { useTheme } from "../../context/ThemeContext";
import { getString } from "../../strings/translations";

export const TTSSettingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { settings, updateReaderSettings } = useSettings();

  const tts = settings.reader.tts;

  const [voices, setVoices] = useState<Speech.Voice[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [voiceModalVisible, setVoiceModalVisible] = useState(false);
  const [languageModalVisible, setLanguageModalVisible] = useState(false);

  const loadVoices = useCallback(async () => {
    setLoadingVoices(true);
    try {
      const next = await Speech.getAvailableVoicesAsync();
      // Sort by language, then name for a stable list.
      const sorted = (next || []).slice().sort((a, b) => {
        const la = String(a.language || "").localeCompare(String(b.language || ""));
        if (la !== 0) return la;
        return String(a.name || "").localeCompare(String(b.name || ""));
      });
      setVoices(sorted);
    } catch (e: any) {
      Alert.alert("Text to Speech", e?.message || "Failed to load voices.");
      setVoices([]);
    } finally {
      setLoadingVoices(false);
    }
  }, []);

  useEffect(() => {
    void loadVoices();
    return () => {
      void Speech.stop();
    };
  }, [loadVoices]);

  const selectedVoice = useMemo(() => {
    const id = tts.voice;
    if (!id) return null;
    return voices.find((v) => v.identifier === id) ?? null;
  }, [tts.voice, voices]);

  const languageOptions = useMemo(() => {
    const languages = Array.from(
      new Set(
        voices
          .map((v) => String(v.language || "").trim())
          .filter((l) => l.length > 0),
      ),
    ).sort((a, b) => a.localeCompare(b));

    return [{ value: "__auto__", label: "Auto (device)" }].concat(
      languages.map((l) => ({ value: l, label: l })),
    );
  }, [voices]);

  const voiceOptions = useMemo(() => {
    const opts = voices.map((v) => ({
      value: v.identifier,
      label: `${v.name} (${v.language})`,
    }));
    return [{ value: "__default__", label: "System default" }].concat(opts);
  }, [voices]);

  const rateLabel = useMemo(() => `${Number(tts.rate || 1).toFixed(1)}x`, [tts.rate]);
  const pitchLabel = useMemo(() => `${Number(tts.pitch || 1).toFixed(1)}x`, [tts.pitch]);

  const clampStep = (value: number, min: number, max: number, step: number) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return min;
    const rounded = Math.round(n / step) * step;
    return Math.max(min, Math.min(max, Number(rounded.toFixed(2))));
  };

  const adjustRate = (delta: number) => {
    const next = clampStep((tts.rate ?? 1) + delta, 0.5, 2.0, 0.1);
    void updateReaderSettings("tts", "rate", next);
  };

  const adjustPitch = (delta: number) => {
    const next = clampStep((tts.pitch ?? 1) + delta, 0.5, 2.0, 0.1);
    void updateReaderSettings("tts", "pitch", next);
  };

  const speakTest = useCallback(() => {
    void Speech.stop();
    Speech.speak("Text to Speech is ready.", {
      rate: tts.rate,
      pitch: tts.pitch,
      language: tts.language || undefined,
      voice: tts.voice || undefined,
    });
  }, [tts.language, tts.pitch, tts.rate, tts.voice]);

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Header
        title={getString("screens.ttsSettings.title")}
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <SettingsSection>
          <SettingsRow
            icon="volume-high-outline"
            label="Enable Text to Speech"
            subtitle="Read chapters aloud in the reader"
            rightElement={
              <ImprovedSwitch
                value={Boolean(tts.enabled)}
                onValueChange={(v) => void updateReaderSettings("tts", "enabled", v)}
              />
            }
          />
          <SettingsRow
            icon="person-circle-outline"
            label="Voice"
            subtitle={
              loadingVoices
                ? "Loading voices..."
                : selectedVoice
                  ? `${selectedVoice.name} (${selectedVoice.language})`
                  : "System default"
            }
            onPress={loadingVoices ? undefined : () => setVoiceModalVisible(true)}
            rightElement={loadingVoices ? <ActivityIndicator size="small" color={theme.colors.primary} /> : undefined}
          />
          <SettingsRow
            icon="language-outline"
            label="Language"
            subtitle={tts.language ? tts.language : "Auto (device)"}
            onPress={loadingVoices ? undefined : () => setLanguageModalVisible(true)}
            rightElement={loadingVoices ? <ActivityIndicator size="small" color={theme.colors.primary} /> : undefined}
          />
          <SettingsRow
            icon="speedometer-outline"
            label="Rate"
            subtitle={rateLabel}
            rightElement={
              <View style={styles.stepper}>
                <TouchableOpacity
                  onPress={() => adjustRate(-0.1)}
                  style={[styles.stepBtn, { borderColor: theme.colors.border }]}
                >
                  <Ionicons name="remove" size={18} color={theme.colors.text} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => adjustRate(0.1)}
                  style={[styles.stepBtn, { borderColor: theme.colors.border }]}
                >
                  <Ionicons name="add" size={18} color={theme.colors.text} />
                </TouchableOpacity>
              </View>
            }
          />
          <SettingsRow
            icon="musical-notes-outline"
            label="Pitch"
            subtitle={pitchLabel}
            rightElement={
              <View style={styles.stepper}>
                <TouchableOpacity
                  onPress={() => adjustPitch(-0.1)}
                  style={[styles.stepBtn, { borderColor: theme.colors.border }]}
                >
                  <Ionicons name="remove" size={18} color={theme.colors.text} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => adjustPitch(0.1)}
                  style={[styles.stepBtn, { borderColor: theme.colors.border }]}
                >
                  <Ionicons name="add" size={18} color={theme.colors.text} />
                </TouchableOpacity>
              </View>
            }
          />
          <SettingsRow
            icon="play-skip-forward-outline"
            label="Auto-advance chapters"
            subtitle="Continue into the next chapter when finished"
            rightElement={
              <ImprovedSwitch
                value={Boolean(tts.autoAdvanceChapters)}
                onValueChange={(v) =>
                  void updateReaderSettings("tts", "autoAdvanceChapters", v)
                }
              />
            }
          />
          <SettingsRow
            icon="play-outline"
            label="Test voice"
            subtitle="Plays a short sample using your settings"
            rightElement={
              <View style={styles.testButtons}>
                <TouchableOpacity
                  onPress={speakTest}
                  style={[
                    styles.testBtn,
                    {
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.primary + "14",
                    },
                  ]}
                >
                  <Ionicons name="play" size={16} color={theme.colors.primary} />
                  <Text style={[styles.testBtnText, { color: theme.colors.primary }]}>
                    Play
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => void Speech.stop()}
                  style={[styles.testBtn, { borderColor: theme.colors.border }]}
                >
                  <Ionicons
                    name="stop"
                    size={16}
                    color={theme.colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.testBtnText,
                      { color: theme.colors.textSecondary },
                    ]}
                  >
                    Stop
                  </Text>
                </TouchableOpacity>
              </View>
            }
            isLast
          />
        </SettingsSection>
      </ScrollView>

      <SelectionModal
        visible={voiceModalVisible}
        title="Select Voice"
        options={voiceOptions}
        selectedValue={tts.voice ? tts.voice : "__default__"}
        onSelect={(value) => {
          const next = value === "__default__" ? null : String(value);
          void updateReaderSettings("tts", "voice", next);
        }}
        onClose={() => setVoiceModalVisible(false)}
      />

      <SelectionModal
        visible={languageModalVisible}
        title="Select Language"
        options={languageOptions}
        selectedValue={tts.language ? tts.language : "__auto__"}
        onSelect={(value) => {
          const next = value === "__auto__" ? null : String(value);
          void updateReaderSettings("tts", "language", next);
        }}
        onClose={() => setLanguageModalVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: 32 },
  stepper: { flexDirection: "row", gap: 10, alignItems: "center" },
  stepBtn: {
    width: 38,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  testButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  testBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  testBtnText: { fontSize: 12, fontWeight: "700" },
});
