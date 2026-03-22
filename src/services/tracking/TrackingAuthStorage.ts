import AsyncStorage from "@react-native-async-storage/async-storage";
import type { TrackerId } from "../../types";
import type { AuthenticationResult } from "./types";

const KEY = "@novelnest_tracker_auth_v1";

type AuthMap = Partial<Record<TrackerId, AuthenticationResult<any>>>;

export const TrackingAuthStorage = {
  async load(): Promise<AuthMap> {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return {};
      return parsed as AuthMap;
    } catch {
      return {};
    }
  },

  async save(map: AuthMap): Promise<void> {
    await AsyncStorage.setItem(KEY, JSON.stringify(map));
  },

  async get(id: TrackerId): Promise<AuthenticationResult<any> | undefined> {
    const map = await this.load();
    return map[id];
  },

  async set(id: TrackerId, auth: AuthenticationResult<any> | undefined) {
    const map = await this.load();
    if (!auth) {
      delete map[id];
    } else {
      map[id] = auth;
    }
    await this.save(map);
  },
};

