// src/screens/settings/TrackingServicesScreen.tsx
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Header } from "../../components/common/Header";
import { useTheme } from "../../context/ThemeContext";
import { TrackingAuthStorage } from "../../services/tracking/TrackingAuthStorage";
import { TrackingService } from "../../services/tracking/TrackingService";
import { trackers } from "../../services/tracking/registry";
import type { TrackerId } from "../../types";
import { getString, t } from "../../strings/translations";

export const TrackingServicesScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();

  const [authMap, setAuthMap] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState<Partial<Record<TrackerId, boolean>>>({});

  const reloadAuth = useCallback(async () => {
    const map = await TrackingAuthStorage.load();
    setAuthMap(map as any);
  }, []);

  useEffect(() => {
    void reloadAuth();
  }, [reloadAuth]);

  const handleConnect = useCallback(
    async (id: TrackerId) => {
      setBusy((p) => ({ ...p, [id]: true }));
      try {
        await TrackingService.authenticate(id);
        await reloadAuth();
      } catch (e: any) {
        Alert.alert(
          getString("tracking.alerts.authFailedTitle"),
          e?.message || getString("tracking.alerts.authFailedBody"),
        );
      } finally {
        setBusy((p) => ({ ...p, [id]: false }));
      }
    },
    [reloadAuth],
  );

  const handleDisconnect = useCallback(
    async (id: TrackerId) => {
      Alert.alert(
        getString("tracking.alerts.disconnectTitle"),
        getString("tracking.alerts.disconnectBody"),
        [
          { text: getString("common.cancel"), style: "cancel" },
          {
            text: getString("tracking.alerts.disconnectAction"),
            style: "destructive",
            onPress: async () => {
              await TrackingService.disconnect(id);
              await reloadAuth();
            },
          },
        ],
      );
    },
    [reloadAuth],
  );

  const entries = useMemo(
    () =>
      trackers.map((tr) => ({
        id: tr.id,
        name: tr.name,
        connected: Boolean((authMap as any)?.[tr.id]?.accessToken),
        expiresAt: (authMap as any)?.[tr.id]?.expiresAt as string | undefined,
      })),
    [authMap],
  );

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Header
        title={getString("screens.trackingServices.title")}
        onBackPress={() => navigation.goBack()}
      />

      <View style={styles.content}>
        <Text style={[styles.note, { color: theme.colors.textSecondary }]}>
          {getString("tracking.note")}
        </Text>

        {entries.map((e) => {
          const isBusy = Boolean(busy[e.id]);
          const expiresLabel = e.expiresAt
            ? t("tracking.expiresAt", {
                date: new Date(e.expiresAt).toLocaleString(),
              })
            : getString("tracking.noExpiry");

          return (
            <View
              key={e.id}
              style={[
                styles.card,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <View style={styles.cardRow}>
                <View
                  style={[
                    styles.iconWrap,
                    { backgroundColor: theme.colors.primary + "18" },
                  ]}
                >
                  <Ionicons
                    name="sync-outline"
                    size={18}
                    color={theme.colors.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.title, { color: theme.colors.text }]}>
                    {e.name}
                  </Text>
                  <Text
                    style={[
                      styles.subtitle,
                      { color: theme.colors.textSecondary },
                    ]}
                  >
                    {e.connected
                      ? getString("tracking.connected")
                      : getString("tracking.notConnected")}
                    {" • "}
                    {expiresLabel}
                  </Text>
                </View>
              </View>

              <View style={styles.actions}>
                {e.connected ? (
                  <>
                    <TouchableOpacity
                      style={[
                        styles.btn,
                        {
                          borderColor: theme.colors.border,
                        },
                      ]}
                      onPress={() => void handleConnect(e.id)}
                      disabled={isBusy}
                    >
                      <Text
                        style={[
                          styles.btnText,
                          { color: theme.colors.text },
                        ]}
                      >
                        {getString("tracking.reauth")}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.btn,
                        {
                          borderColor: theme.colors.error,
                          backgroundColor: theme.colors.error + "12",
                        },
                      ]}
                      onPress={() => void handleDisconnect(e.id)}
                      disabled={isBusy}
                    >
                      <Text
                        style={[styles.btnText, { color: theme.colors.error }]}
                      >
                        {getString("tracking.disconnect")}
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.btnPrimary,
                      { backgroundColor: theme.colors.primary },
                    ]}
                    onPress={() => void handleConnect(e.id)}
                    disabled={isBusy}
                  >
                    <Text style={[styles.btnText, { color: "#FFF" }]}>
                      {getString("tracking.connect")}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: 16, gap: 12 },
  note: { fontSize: 13, lineHeight: 18, marginBottom: 4 },
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 12,
  },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  title: { fontSize: 16, fontWeight: "800" },
  subtitle: { fontSize: 12, marginTop: 2 },
  actions: { flexDirection: "row", gap: 10 },
  btnPrimary: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  btn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
  },
  btnText: { fontSize: 13, fontWeight: "800" },
});
