import type { Tracker } from "./types";
import type { TrackerId } from "../../types";
import { aniListTracker } from "./trackers/anilist";
import { myAnimeListTracker } from "./trackers/myanimelist";

export const trackers = [aniListTracker, myAnimeListTracker] as const;

export const getTracker = (id: TrackerId): Tracker => {
  const found = trackers.find((t) => t.id === id);
  if (!found) throw new Error(`Unknown tracker: ${id}`);
  return found;
};
