import type { TrackerId } from "../../types";
import { TrackingAuthStorage } from "./TrackingAuthStorage";
import { getTracker } from "./registry";
import type { AuthenticationResult } from "./types";

const isExpired = (auth?: AuthenticationResult<any>) => {
  if (!auth?.expiresAt) return false;
  const t = new Date(auth.expiresAt).getTime();
  if (!Number.isFinite(t)) return false;
  // refresh 60s early
  return Date.now() > t - 60_000;
};

export const TrackingService = {
  async getAuth(trackerId: TrackerId) {
    return TrackingAuthStorage.get(trackerId);
  },

  async setAuth(trackerId: TrackerId, auth?: AuthenticationResult<any>) {
    await TrackingAuthStorage.set(trackerId, auth);
  },

  async authenticate(trackerId: TrackerId) {
    const tracker = getTracker(trackerId);
    const auth = await tracker.authenticate();
    await TrackingAuthStorage.set(trackerId, auth);
    return auth;
  },

  async disconnect(trackerId: TrackerId) {
    await TrackingAuthStorage.set(trackerId, undefined);
  },

  async ensureValidAuth(trackerId: TrackerId) {
    const tracker = getTracker(trackerId);
    const current = await TrackingAuthStorage.get(trackerId);
    if (!current) throw new Error("Not authenticated.");
    if (!isExpired(current)) return current;

    if (!tracker.revalidate) return current;
    const next = await tracker.revalidate(current);
    await TrackingAuthStorage.set(trackerId, next);
    return next;
  },
};

